import uuid
from datetime import datetime, date, timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import Sum, Count, Q
from django.utils import timezone
from rest_framework import viewsets, permissions, status, filters
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django_filters.rest_framework import DjangoFilterBackend

from core.models import User, Branch, AuditLog
from core.services import log_audit_event
from core.permissions import IsAdminOrFinance, IsBranchManager, IsCollectionAgent
from loans.models import Customer, Loan, RepaymentSchedule
from collections_app.models import Collection, CashSubmission, Discrepancy
from banking.models import BankDeposit
from api.serializers import (
    UserSerializer, BranchSerializer, CustomerSerializer,
    LoanSerializer, RepaymentScheduleSerializer, CollectionSerializer,
    CashSubmissionSerializer, CashSubmissionReconcileSerializer, CashSubmissionRejectSerializer,
    DiscrepancySerializer, BankDepositSerializer, BankSettlementSerializer,
    AuditLogSerializer
)

# -------------------------------------------------------------------------
# Authentication & Demo Users
# -------------------------------------------------------------------------

class CMRSTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        user_serializer = UserSerializer(self.user)
        data['user'] = user_serializer.data
        return data


class CMRSTokenObtainPairView(TokenObtainPairView):
    serializer_class = CMRSTokenObtainPairSerializer


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def me_view(request):
    """Returns profile and branch details for currently logged-in user."""
    serializer = UserSerializer(request.user)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def demo_users_view(request):
    """
    Returns list of predefined test accounts across all roles for 1-click evaluation.
    """
    users = [
        {
            "role": "Super Admin / Finance Controller",
            "username": "admin",
            "password": "Password@123",
            "name": "Super Admin",
            "email": "admin@cmrs.fintech",
            "branch": "All Branches (Head Office)",
            "description": "Full access to all branches, collections, reconciliations, bank settlements, and audit logs."
        },
        {
            "role": "Branch Manager",
            "username": "bm_mumbai",
            "password": "Password@123",
            "name": "Vikram Seth (Branch Manager)",
            "email": "bm.mumbai@cmrs.fintech",
            "branch": "Mumbai Central (BR-MUM-01)",
            "description": "Verifies agent cash submissions, handles discrepancy approvals/rejections, and initiates bank deposits."
        },
        {
            "role": "Branch Manager",
            "username": "bm_delhi",
            "password": "Password@123",
            "name": "Sunita Verma (Branch Manager)",
            "email": "bm.delhi@cmrs.fintech",
            "branch": "Delhi North (BR-DEL-02)",
            "description": "Oversees Delhi North branch operations, vault balance, and bank deposits."
        },
        {
            "role": "Collection Agent",
            "username": "agent_rajesh",
            "password": "Password@123",
            "name": "Rajesh Kumar (Field Agent)",
            "email": "agent.rajesh@cmrs.fintech",
            "branch": "Mumbai Central (BR-MUM-01)",
            "description": "Collects cash from Mumbai customers, issues digital receipts, and submits cash batches to branch."
        },
        {
            "role": "Collection Agent",
            "username": "agent_priya",
            "password": "Password@123",
            "name": "Priya Sharma (Field Agent)",
            "email": "agent.priya@cmrs.fintech",
            "branch": "Delhi North (BR-DEL-02)",
            "description": "Field agent operating in Delhi North territory."
        }
    ]
    return Response(users)


# -------------------------------------------------------------------------
# Branches ViewSet
# -------------------------------------------------------------------------

class BranchViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Branch.objects.filter(is_active=True)
    serializer_class = BranchSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'code', 'city']


# -------------------------------------------------------------------------
# Customer & Loan Management
# -------------------------------------------------------------------------

class CustomerViewSet(viewsets.ModelViewSet):
    serializer_class = CustomerSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['branch', 'assigned_agent']
    search_fields = ['customer_code', 'first_name', 'last_name', 'phone', 'national_id']
    ordering_fields = ['customer_code', 'created_at']

    def get_queryset(self):
        user = self.request.user
        qs = Customer.objects.select_related('branch', 'assigned_agent')
        if user.is_admin_or_finance:
            return qs.all()
        if user.is_branch_manager and user.branch:
            return qs.filter(branch=user.branch)
        if user.is_collection_agent:
            return qs.filter(Q(assigned_agent=user) | Q(branch=user.branch))
        return qs.none()


class LoanViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = LoanSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['branch', 'status', 'customer']
    search_fields = ['loan_account_number', 'customer__first_name', 'customer__last_name', 'customer__customer_code']
    ordering_fields = ['loan_account_number', 'outstanding_balance', 'created_at']

    def get_queryset(self):
        user = self.request.user
        qs = Loan.objects.select_related('customer', 'branch').prefetch_related('schedules')
        if user.is_admin_or_finance:
            return qs.all()
        if user.is_branch_manager and user.branch:
            return qs.filter(branch=user.branch)
        if user.is_collection_agent:
            return qs.filter(Q(customer__assigned_agent=user) | Q(branch=user.branch))
        return qs.none()

    @action(detail=True, methods=['get'])
    def schedules(self, request, pk=None):
        """Returns the full installment repayment schedule for a loan."""
        loan = self.get_object()
        schedules = loan.schedules.all().order_by('installment_number')
        serializer = RepaymentScheduleSerializer(schedules, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def history(self, request, pk=None):
        """Returns repayment history (receipts) for this loan."""
        loan = self.get_object()
        collections = loan.collections.all().order_by('-collected_at')
        serializer = CollectionSerializer(collections, many=True)
        return Response(serializer.data)


# -------------------------------------------------------------------------
# Collections & Cash Collection Workflow
# -------------------------------------------------------------------------

class CollectionViewSet(viewsets.ModelViewSet):
    serializer_class = CollectionSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['branch', 'agent', 'status', 'payment_mode', 'loan', 'customer']
    search_fields = ['receipt_number', 'customer__first_name', 'customer__last_name', 'customer__customer_code', 'loan__loan_account_number']
    ordering_fields = ['collected_at', 'amount']

    def get_queryset(self):
        user = self.request.user
        qs = Collection.objects.select_related('loan', 'customer', 'agent', 'branch', 'cash_submission')
        if user.is_admin_or_finance:
            return qs.all()
        if user.is_branch_manager and user.branch:
            return qs.filter(branch=user.branch)
        if user.is_collection_agent:
            return qs.filter(agent=user)
        return qs.none()

    def update(self, request, *args, **kwargs):
        collection = self.get_object()
        if collection.status in [Collection.Status.RECONCILED, Collection.Status.BANK_DEPOSITED, Collection.Status.SETTLED]:
            return Response(
                {"detail": "Unauthorized modification: Reconciled, deposited, or settled transactions are immutable financial records."},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        collection = self.get_object()
        if collection.status != Collection.Status.COLLECTED:
            return Response(
                {"detail": "Cannot delete a collection that has already been submitted, reconciled, or settled."},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().destroy(request, *args, **kwargs)

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        """
        Record a new customer repayment (Cash or UPI Sandbox).
        Ensures partial payment tracking, over-collection protection, unique receipt, and audit logging.
        """
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user
        loan = serializer.validated_data['loan']
        amount = serializer.validated_data['amount']
        payment_mode = serializer.validated_data.get('payment_mode', Collection.PaymentMode.CASH)
        notes = serializer.validated_data.get('notes', '')
        idempotency_key = serializer.validated_data['idempotency_key']
        schedule = serializer.validated_data.get('schedule', None)

        # Generate unique receipt number: REC-YYYYMMDD-XXXXXX
        date_str = timezone.now().strftime('%Y%m%d')
        unique_suffix = uuid.uuid4().hex[:6].upper()
        receipt_number = f"REC-{date_str}-{unique_suffix}"

        # If payment is UPI Sandbox, generate sandbox reference
        payment_reference = ""
        if payment_mode == Collection.PaymentMode.UPI_SANDBOX:
            payment_reference = f"UPI-SANDBOX-{uuid.uuid4().hex[:8].upper()}"

        branch = loan.branch

        # Determine target schedule installment to allocate payment
        if not schedule:
            schedule = loan.schedules.filter(status__in=[RepaymentSchedule.Status.PENDING, RepaymentSchedule.Status.PARTIAL]).order_by('installment_number').first()

        # Allocate repayment to schedules
        remaining_to_allocate = amount
        if schedule:
            schedules_to_update = loan.schedules.filter(installment_number__gte=schedule.installment_number, status__in=[RepaymentSchedule.Status.PENDING, RepaymentSchedule.Status.PARTIAL]).order_by('installment_number')
            for sched in schedules_to_update:
                if remaining_to_allocate <= Decimal('0.00'):
                    break
                due_left = sched.remaining_amount
                allocation = min(due_left, remaining_to_allocate)
                sched.paid_amount += allocation
                remaining_to_allocate -= allocation
                if sched.paid_amount >= sched.due_amount:
                    sched.status = RepaymentSchedule.Status.PAID
                else:
                    sched.status = RepaymentSchedule.Status.PARTIAL
                sched.save()

        # Update loan outstanding balance
        loan.apply_repayment(amount)

        # Set initial status based on payment mode
        if payment_mode == Collection.PaymentMode.UPI_SANDBOX:
            # Digital payment flows directly into settled company accounts
            col_status = Collection.Status.SETTLED
        else:
            col_status = Collection.Status.COLLECTED
            # Update agent's physical cash-in-hand
            user.cash_in_hand += amount
            user.save(update_fields=['cash_in_hand'])

        collection = Collection.objects.create(
            receipt_number=receipt_number,
            loan=loan,
            customer=loan.customer,
            agent=user,
            branch=branch,
            schedule=schedule,
            amount=amount,
            payment_mode=payment_mode,
            payment_reference=payment_reference,
            status=col_status,
            idempotency_key=idempotency_key,
            notes=notes
        )

        log_audit_event(
            actor=user,
            action='COLLECTION_RECORDED',
            entity_type='Collection',
            entity_id=collection.receipt_number,
            details={
                'loan': loan.loan_account_number,
                'customer': loan.customer.full_name,
                'amount': str(amount),
                'payment_mode': payment_mode,
                'new_outstanding': str(loan.outstanding_balance)
            },
            request=request
        )

        output_serializer = CollectionSerializer(collection)
        return Response(output_serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def daily_summary(self, request):
        """
        Returns today's collections metrics for the current agent.
        """
        user = request.user
        today = timezone.now().date()
        today_collections = Collection.objects.filter(agent=user, collected_at__date=today)
        unsubmitted_collections = Collection.objects.filter(agent=user, status=Collection.Status.COLLECTED, payment_mode=Collection.PaymentMode.CASH)

        today_total = today_collections.aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        unsubmitted_total = unsubmitted_collections.aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

        return Response({
            'today_collections_count': today_collections.count(),
            'today_total_amount': today_total,
            'unsubmitted_cash_amount': unsubmitted_total,
            'unsubmitted_count': unsubmitted_collections.count(),
            'cash_in_hand': user.cash_in_hand
        })

    @action(detail=False, methods=['post'])
    @transaction.atomic
    def submit_batch(self, request):
        """
        Collection Agent bundles unsubmitted cash collections into a CashSubmission batch to hand over to branch.
        """
        user = request.user
        if not user.branch:
            return Response({"detail": "User has no assigned branch to submit cash to."}, status=status.HTTP_400_BAD_REQUEST)

        # Allow passing specific collection IDs or default to all unsubmitted cash collections
        collection_ids = request.data.get('collection_ids', None)
        notes = request.data.get('agent_notes', '')

        unsubmitted_qs = Collection.objects.filter(
            agent=user,
            status=Collection.Status.COLLECTED,
            payment_mode=Collection.PaymentMode.CASH
        )

        if collection_ids:
            unsubmitted_qs = unsubmitted_qs.filter(id__in=collection_ids)

        collections = list(unsubmitted_qs)
        if not collections:
            return Response({"detail": "No unsubmitted cash collections available for submission."}, status=status.HTTP_400_BAD_REQUEST)

        total_expected = sum(c.amount for c in collections)
        date_str = timezone.now().strftime('%Y%m%d')
        sub_number = f"SUB-{date_str}-{uuid.uuid4().hex[:6].upper()}"

        submission = CashSubmission.objects.create(
            submission_number=sub_number,
            agent=user,
            branch=user.branch,
            total_expected_amount=total_expected,
            status=CashSubmission.Status.PENDING_APPROVAL,
            agent_notes=notes
        )

        # Mark all selected collections as SUBMITTED and link to submission
        for c in collections:
            c.status = Collection.Status.SUBMITTED
            c.cash_submission = submission
            c.save(update_fields=['status', 'cash_submission'])

        log_audit_event(
            actor=user,
            action='CASH_SUBMISSION_CREATED',
            entity_type='CashSubmission',
            entity_id=submission.submission_number,
            details={
                'total_expected_amount': str(total_expected),
                'receipts_count': len(collections),
                'branch': user.branch.name
            },
            request=request
        )

        serializer = CashSubmissionSerializer(submission)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


# -------------------------------------------------------------------------
# Cash Submission & Branch Reconciliation Workflow
# -------------------------------------------------------------------------

class CashSubmissionViewSet(viewsets.ModelViewSet):
    serializer_class = CashSubmissionSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['branch', 'agent', 'status']
    search_fields = ['submission_number', 'agent__username', 'agent__first_name', 'agent__last_name']
    ordering_fields = ['submission_date', 'total_expected_amount']

    def get_queryset(self):
        user = self.request.user
        qs = CashSubmission.objects.select_related('agent', 'branch', 'reconciled_by', 'bank_deposit').prefetch_related('collections', 'discrepancies')
        if user.is_admin_or_finance:
            return qs.all()
        if user.is_branch_manager and user.branch:
            return qs.filter(branch=user.branch)
        if user.is_collection_agent:
            return qs.filter(agent=user)
        return qs.none()

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def reconcile(self, request, pk=None):
        """
        Branch Manager verifies physical cash handed in by agent against receipt sum.
        Calculates discrepancy, moves cash to branch vault balance, updates collection statuses.
        """
        user = request.user
        if not (user.is_branch_manager or user.is_admin_or_finance):
            return Response({"detail": "Only Branch Managers or Admins can reconcile cash submissions."}, status=status.HTTP_403_FORBIDDEN)

        submission = self.get_object()
        if submission.status != CashSubmission.Status.PENDING_APPROVAL:
            return Response({"detail": f"Submission is already {submission.get_status_display()} and cannot be reconciled."}, status=status.HTTP_400_BAD_REQUEST)

        rec_serializer = CashSubmissionReconcileSerializer(data=request.data)
        rec_serializer.is_valid(raise_exception=True)

        actual_amount = rec_serializer.validated_data['total_actual_amount']
        branch_notes = rec_serializer.validated_data.get('branch_notes', '')

        expected_amount = submission.total_expected_amount
        difference = actual_amount - expected_amount

        submission.total_actual_amount = actual_amount
        submission.discrepancy_amount = difference
        submission.status = CashSubmission.Status.RECONCILED
        submission.reconciled_by = user
        submission.reconciled_at = timezone.now()
        submission.branch_notes = branch_notes
        submission.save()

        # If discrepancy exists, record Discrepancy model
        if difference != Decimal('0.00'):
            discrepancy_type = Discrepancy.DiscrepancyType.SHORTAGE if difference < Decimal('0.00') else Discrepancy.DiscrepancyType.EXCESS
            Discrepancy.objects.create(
                submission=submission,
                agent=submission.agent,
                branch=submission.branch,
                expected_amount=expected_amount,
                actual_amount=actual_amount,
                difference=difference,
                discrepancy_type=discrepancy_type,
                resolution_status=Discrepancy.ResolutionStatus.OPEN,
                resolution_notes=f"Flagged during branch verification by {user.get_full_name()}."
            )

        # Update all collections in batch to RECONCILED (Branch Received)
        submission.collections.all().update(status=Collection.Status.RECONCILED)

        # Add physical cash to branch vault balance
        branch = submission.branch
        branch.vault_cash_balance += actual_amount
        branch.save(update_fields=['vault_cash_balance'])

        # Deduct expected amount from agent's cash-in-hand
        agent = submission.agent
        agent.cash_in_hand = max(Decimal('0.00'), agent.cash_in_hand - expected_amount)
        agent.save(update_fields=['cash_in_hand'])

        log_audit_event(
            actor=user,
            action='SUBMISSION_RECONCILED',
            entity_type='CashSubmission',
            entity_id=submission.submission_number,
            details={
                'expected': str(expected_amount),
                'actual': str(actual_amount),
                'difference': str(difference),
                'branch_vault_new_balance': str(branch.vault_cash_balance)
            },
            request=request
        )

        return Response(CashSubmissionSerializer(submission).data)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def reject(self, request, pk=None):
        """
        Branch Manager rejects cash submission back to agent with a mandatory explanation.
        Collections revert to COLLECTED status so agent can recount or correct.
        """
        user = request.user
        if not (user.is_branch_manager or user.is_admin_or_finance):
            return Response({"detail": "Only Branch Managers or Admins can reject cash submissions."}, status=status.HTTP_403_FORBIDDEN)

        submission = self.get_object()
        if submission.status != CashSubmission.Status.PENDING_APPROVAL:
            return Response({"detail": f"Submission is {submission.get_status_display()} and cannot be rejected."}, status=status.HTTP_400_BAD_REQUEST)

        rej_serializer = CashSubmissionRejectSerializer(data=request.data)
        rej_serializer.is_valid(raise_exception=True)

        reason = rej_serializer.validated_data['rejection_reason']
        submission.status = CashSubmission.Status.REJECTED
        submission.rejection_reason = reason
        submission.save(update_fields=['status', 'rejection_reason'])

        # Revert collections to COLLECTED status so agent still has active cash-in-hand
        submission.collections.all().update(status=Collection.Status.COLLECTED, cash_submission=None)

        log_audit_event(
            actor=user,
            action='SUBMISSION_REJECTED',
            entity_type='CashSubmission',
            entity_id=submission.submission_number,
            details={
                'reason': reason,
                'agent': submission.agent.username
            },
            request=request
        )

        return Response(CashSubmissionSerializer(submission).data)


# -------------------------------------------------------------------------
# Discrepancy Tracking
# -------------------------------------------------------------------------

class DiscrepancyViewSet(viewsets.ModelViewSet):
    serializer_class = DiscrepancySerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['branch', 'agent', 'discrepancy_type', 'resolution_status']
    search_fields = ['submission__submission_number', 'agent__username', 'resolution_notes']
    ordering_fields = ['created_at', 'difference']

    def get_queryset(self):
        user = self.request.user
        qs = Discrepancy.objects.select_related('submission', 'agent', 'branch', 'resolved_by')
        if user.is_admin_or_finance:
            return qs.all()
        if user.is_branch_manager and user.branch:
            return qs.filter(branch=user.branch)
        if user.is_collection_agent:
            return qs.filter(agent=user)
        return qs.none()

    @action(detail=True, methods=['post'])
    def resolve(self, request, pk=None):
        """Resolve or update status of a discrepancy."""
        user = request.user
        if not (user.is_branch_manager or user.is_admin_or_finance):
            return Response({"detail": "Only Branch Managers or Admins can resolve discrepancies."}, status=status.HTTP_403_FORBIDDEN)

        discrepancy = self.get_object()
        new_status = request.data.get('resolution_status', Discrepancy.ResolutionStatus.RESOLVED)
        notes = request.data.get('resolution_notes', '')

        discrepancy.resolution_status = new_status
        discrepancy.resolution_notes = notes
        discrepancy.resolved_by = user
        discrepancy.resolved_at = timezone.now()
        discrepancy.save()

        log_audit_event(
            actor=user,
            action='DISCREPANCY_RESOLVED',
            entity_type='Discrepancy',
            entity_id=discrepancy.id,
            details={'status': new_status, 'notes': notes},
            request=request
        )

        return Response(DiscrepancySerializer(discrepancy).data)


# -------------------------------------------------------------------------
# Bank Deposit & Settlement Workflow
# -------------------------------------------------------------------------

class BankDepositViewSet(viewsets.ModelViewSet):
    serializer_class = BankDepositSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['branch', 'status', 'bank_name', 'deposit_date']
    search_fields = ['deposit_slip_number', 'bank_reference_number', 'branch__name']
    ordering_fields = ['deposit_date', 'amount', 'created_at']

    def get_queryset(self):
        user = self.request.user
        qs = BankDeposit.objects.select_related('branch', 'created_by', 'settled_by').prefetch_related('cash_submissions')
        if user.is_admin_or_finance:
            return qs.all()
        if user.is_branch_manager and user.branch:
            return qs.filter(branch=user.branch)
        return qs.none()

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        """
        Creates a Bank Deposit against reconciled cash in the branch vault.
        Validates duplicate bank reference numbers and sufficient vault cash balance.
        """
        user = request.user
        if not (user.is_branch_manager or user.is_admin_or_finance):
            return Response({"detail": "Only Branch Managers or Admins can create bank deposits."}, status=status.HTTP_403_FORBIDDEN)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        branch = serializer.validated_data['branch']
        amount = serializer.validated_data['amount']
        bank_ref = serializer.validated_data['bank_reference_number']
        submission_ids = serializer.validated_data.get('submission_ids', [])

        date_str = timezone.now().strftime('%Y%m%d')
        slip_number = f"DEP-{date_str}-{uuid.uuid4().hex[:6].upper()}"

        deposit = BankDeposit.objects.create(
            deposit_slip_number=slip_number,
            branch=branch,
            bank_name=serializer.validated_data['bank_name'],
            bank_account_number=serializer.validated_data['bank_account_number'],
            deposit_date=serializer.validated_data['deposit_date'],
            amount=amount,
            bank_reference_number=bank_ref,
            status=BankDeposit.Status.DEPOSITED,
            created_by=user,
            notes=serializer.validated_data.get('notes', '')
        )

        # Deduct deposited cash from branch vault balance
        branch.vault_cash_balance -= amount
        branch.save(update_fields=['vault_cash_balance'])

        # Associate submissions if provided
        if submission_ids:
            submissions = CashSubmission.objects.filter(id__in=submission_ids, branch=branch)
            for sub in submissions:
                sub.bank_deposit = deposit
                sub.status = CashSubmission.Status.BANK_DEPOSITED
                sub.save(update_fields=['bank_deposit', 'status'])
                sub.collections.all().update(status=Collection.Status.BANK_DEPOSITED)

        log_audit_event(
            actor=user,
            action='BANK_DEPOSIT_CREATED',
            entity_type='BankDeposit',
            entity_id=deposit.deposit_slip_number,
            details={
                'amount': str(amount),
                'bank_reference': bank_ref,
                'branch_vault_new_balance': str(branch.vault_cash_balance)
            },
            request=request
        )

        output_serializer = BankDepositSerializer(deposit)
        return Response(output_serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def settle(self, request, pk=None):
        """
        Verify bank statement credit against the bank deposit slip.
        Identifies differences between branch-reconciled and bank-settled amounts.
        """
        user = request.user
        if not (user.is_admin_or_finance or user.is_branch_manager):
            return Response({"detail": "Only Finance Controller or Branch Managers can settle deposits."}, status=status.HTTP_403_FORBIDDEN)

        deposit = self.get_object()
        settle_serializer = BankSettlementSerializer(data=request.data)
        settle_serializer.is_valid(raise_exception=True)

        settled_amount = settle_serializer.validated_data['settled_amount']
        notes = settle_serializer.validated_data.get('settlement_notes', '')

        variance = settled_amount - deposit.amount
        deposit.settled_amount = settled_amount
        deposit.settlement_variance = variance
        deposit.settled_at = timezone.now()
        deposit.settled_by = user
        deposit.settlement_notes = notes

        if variance == Decimal('0.00'):
            deposit.status = BankDeposit.Status.SETTLED
        else:
            deposit.status = BankDeposit.Status.SETTLEMENT_MISMATCH

        deposit.save()

        # Update collections under this deposit to SETTLED
        for sub in deposit.cash_submissions.all():
            sub.collections.all().update(status=Collection.Status.SETTLED)

        log_audit_event(
            actor=user,
            action='BANK_DEPOSIT_SETTLED',
            entity_type='BankDeposit',
            entity_id=deposit.deposit_slip_number,
            details={
                'deposit_amount': str(deposit.amount),
                'settled_amount': str(settled_amount),
                'variance': str(variance),
                'status': deposit.status
            },
            request=request
        )

        return Response(BankDepositSerializer(deposit).data)

    @action(detail=True, methods=['post'])
    def mark_failed(self, request, pk=None):
        """Mark a bank deposit as failed/bounced."""
        deposit = self.get_object()
        reason = request.data.get('reason', 'Bank returned deposit transaction')
        deposit.status = BankDeposit.Status.FAILED
        deposit.settlement_notes = f"FAILED: {reason}"
        deposit.save(update_fields=['status', 'settlement_notes'])

        log_audit_event(
            actor=request.user,
            action='BANK_DEPOSIT_FAILED',
            entity_type='BankDeposit',
            entity_id=deposit.deposit_slip_number,
            details={'reason': reason},
            request=request
        )

        return Response(BankDepositSerializer(deposit).data)


# -------------------------------------------------------------------------
# Dashboard & Analytics Reports
# -------------------------------------------------------------------------

class DashboardAnalyticsView(APIView):
    """
    Comprehensive dashboard metrics showing:
    - Expected collections
    - Total collected
    - Cash held by agents
    - Cash received at branches (vaults)
    - Bank deposits
    - Settled amount
    - Outstanding amount
    - Reconciliation discrepancies
    - Filtering by date, branch, agent, and status
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        branch_id = request.query_params.get('branch_id')
        agent_id = request.query_params.get('agent_id')
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')

        # Base querysets
        loans_qs = Loan.objects.all()
        schedules_qs = RepaymentSchedule.objects.all()
        collections_qs = Collection.objects.all()
        branches_qs = Branch.objects.filter(is_active=True)
        submissions_qs = CashSubmission.objects.all()
        deposits_qs = BankDeposit.objects.all()
        discrepancies_qs = Discrepancy.objects.all()
        agents_qs = User.objects.filter(role=User.Role.COLLECTION_AGENT)

        # Enforce role-based scoping
        if user.is_branch_manager and user.branch:
            branch_id = str(user.branch.id)
        elif user.is_collection_agent:
            agent_id = str(user.id)
            if user.branch:
                branch_id = str(user.branch.id)

        # Apply filters
        if branch_id:
            loans_qs = loans_qs.filter(branch_id=branch_id)
            schedules_qs = schedules_qs.filter(loan__branch_id=branch_id)
            collections_qs = collections_qs.filter(branch_id=branch_id)
            branches_qs = branches_qs.filter(id=branch_id)
            submissions_qs = submissions_qs.filter(branch_id=branch_id)
            deposits_qs = deposits_qs.filter(branch_id=branch_id)
            discrepancies_qs = discrepancies_qs.filter(branch_id=branch_id)
            agents_qs = agents_qs.filter(branch_id=branch_id)

        if agent_id:
            collections_qs = collections_qs.filter(agent_id=agent_id)
            submissions_qs = submissions_qs.filter(agent_id=agent_id)
            discrepancies_qs = discrepancies_qs.filter(agent_id=agent_id)
            loans_qs = loans_qs.filter(customer__assigned_agent_id=agent_id)

        if start_date:
            collections_qs = collections_qs.filter(collected_at__date__gte=start_date)
            deposits_qs = deposits_qs.filter(deposit_date__gte=start_date)
            schedules_qs = schedules_qs.filter(due_date__gte=start_date)
        if end_date:
            collections_qs = collections_qs.filter(collected_at__date__lte=end_date)
            deposits_qs = deposits_qs.filter(deposit_date__lte=end_date)
            schedules_qs = schedules_qs.filter(due_date__lte=end_date)

        # 1. Expected Collections (due in period)
        expected_amount = schedules_qs.aggregate(total=Sum('due_amount'))['total'] or Decimal('0.00')

        # 2. Total Collected (Cash + Digital)
        total_collected = collections_qs.aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

        # 3. Cash Held by Agents
        # Sum of collections in COLLECTED status OR cash_in_hand of filtered agents
        cash_held_by_agents = collections_qs.filter(
            status__in=[Collection.Status.COLLECTED, Collection.Status.SUBMITTED],
            payment_mode=Collection.PaymentMode.CASH
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

        # 4. Cash Received at Branches (Vault Balances)
        cash_in_branches = branches_qs.aggregate(total=Sum('vault_cash_balance'))['total'] or Decimal('0.00')

        # 5. Bank Deposits Total
        bank_deposits_total = deposits_qs.aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

        # 6. Settled Amount (Successfully settled bank deposits + digital collections)
        settled_bank = deposits_qs.filter(status=BankDeposit.Status.SETTLED).aggregate(total=Sum('settled_amount'))['total'] or Decimal('0.00')
        digital_settled = collections_qs.filter(payment_mode=Collection.PaymentMode.UPI_SANDBOX, status=Collection.Status.SETTLED).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        total_settled = settled_bank + digital_settled

        # 7. Total Outstanding Loan Amount
        outstanding_amount = loans_qs.aggregate(total=Sum('outstanding_balance'))['total'] or Decimal('0.00')

        # 8. Reconciliation Discrepancies
        discrepancy_sum = discrepancies_qs.aggregate(total=Sum('difference'))['total'] or Decimal('0.00')
        open_discrepancies_count = discrepancies_qs.filter(resolution_status=Discrepancy.ResolutionStatus.OPEN).count()

        # 9. Lifecycle Funnel breakdown:
        # Expected -> Collected -> Branch Received (Reconciled) -> Bank Deposited -> Settled
        funnel = {
            'expected': {
                'count': schedules_qs.count(),
                'amount': expected_amount
            },
            'collected': {
                'count': collections_qs.count(),
                'amount': total_collected
            },
            'branch_received': {
                'count': collections_qs.filter(status__in=[Collection.Status.RECONCILED, Collection.Status.BANK_DEPOSITED, Collection.Status.SETTLED]).count(),
                'amount': collections_qs.filter(status__in=[Collection.Status.RECONCILED, Collection.Status.BANK_DEPOSITED, Collection.Status.SETTLED]).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
            },
            'bank_deposited': {
                'count': deposits_qs.count(),
                'amount': bank_deposits_total
            },
            'settled': {
                'count': deposits_qs.filter(status=BankDeposit.Status.SETTLED).count(),
                'amount': total_settled
            }
        }

        # 10. Delayed settlements (>48h in DEPOSITED state)
        cutoff = timezone.now() - timedelta(days=2)
        delayed_deposits = deposits_qs.filter(status=BankDeposit.Status.DEPOSITED, created_at__lte=cutoff).count()

        # 11. Recent 7 days collection trend
        trend_data = []
        today = timezone.now().date()
        for i in range(6, -1, -1):
            day = today - timedelta(days=i)
            day_sum = collections_qs.filter(collected_at__date=day).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
            trend_data.append({
                'date': day.strftime('%d %b'),
                'amount': float(day_sum)
            })

        # 12. Branch wise breakdown
        branch_summary = []
        for b in Branch.objects.filter(is_active=True):
            b_collections = Collection.objects.filter(branch=b).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
            b_deposits = BankDeposit.objects.filter(branch=b).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
            branch_summary.append({
                'id': b.id,
                'name': b.name,
                'city': b.city,
                'vault_balance': float(b.vault_cash_balance),
                'total_collected': float(b_collections),
                'bank_deposited': float(b_deposits)
            })

        return Response({
            'kpis': {
                'expected_collections': expected_amount,
                'total_collected': total_collected,
                'cash_held_by_agents': cash_held_by_agents,
                'cash_in_branches': cash_in_branches,
                'bank_deposits_total': bank_deposits_total,
                'settled_amount': total_settled,
                'outstanding_loan_amount': outstanding_amount,
                'discrepancy_amount': discrepancy_sum,
                'open_discrepancies_count': open_discrepancies_count,
                'delayed_settlements_count': delayed_deposits,
            },
            'funnel': funnel,
            'daily_trend': trend_data,
            'branch_summary': branch_summary
        })


# -------------------------------------------------------------------------
# Audit Logs ViewSet
# -------------------------------------------------------------------------

class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditLog.objects.select_related('actor').all()
    serializer_class = AuditLogSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['action', 'entity_type']
    search_fields = ['entity_id', 'action', 'actor__username']
    ordering_fields = ['timestamp']
