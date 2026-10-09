from rest_framework import serializers
from decimal import Decimal
from core.models import User, Branch, AuditLog
from loans.models import Customer, Loan, RepaymentSchedule
from collections_app.models import Collection, CashSubmission, Discrepancy
from banking.models import BankDeposit

class BranchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Branch
        fields = ['id', 'code', 'name', 'city', 'state', 'address', 'contact_number', 'vault_cash_balance', 'is_active', 'created_at']
        read_only_fields = ['vault_cash_balance', 'created_at']


class UserSerializer(serializers.ModelSerializer):
    branch_details = BranchSerializer(source='branch', read_only=True)
    full_name = serializers.CharField(source='get_full_name', read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name', 'full_name',
            'role', 'branch', 'branch_details', 'employee_id', 'phone_number',
            'cash_in_hand', 'is_active'
        ]
        read_only_fields = ['cash_in_hand']


class RepaymentScheduleSerializer(serializers.ModelSerializer):
    remaining_amount = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = RepaymentSchedule
        fields = [
            'id', 'loan', 'installment_number', 'due_date', 
            'due_amount', 'paid_amount', 'remaining_amount', 'status'
        ]
        read_only_fields = ['paid_amount', 'status', 'remaining_amount']


class CustomerSerializer(serializers.ModelSerializer):
    branch_details = BranchSerializer(source='branch', read_only=True)
    assigned_agent_name = serializers.CharField(source='assigned_agent.get_full_name', read_only=True)
    full_name = serializers.CharField(read_only=True)

    class Meta:
        model = Customer
        fields = [
            'id', 'customer_code', 'first_name', 'last_name', 'full_name',
            'phone', 'email', 'address', 'national_id',
            'assigned_agent', 'assigned_agent_name', 'branch', 'branch_details',
            'created_at'
        ]


class LoanSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='customer.full_name', read_only=True)
    customer_code = serializers.CharField(source='customer.customer_code', read_only=True)
    customer_phone = serializers.CharField(source='customer.phone', read_only=True)
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    schedules = RepaymentScheduleSerializer(many=True, read_only=True)

    class Meta:
        model = Loan
        fields = [
            'id', 'loan_account_number', 'customer', 'customer_name', 'customer_code', 'customer_phone',
            'branch', 'branch_name', 'principal_amount', 'interest_rate', 'tenure_months',
            'total_amount_payable', 'total_amount_collected', 'outstanding_balance',
            'status', 'disbursed_at', 'created_at', 'schedules'
        ]
        read_only_fields = ['total_amount_collected', 'outstanding_balance', 'status', 'created_at']


class CollectionSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='customer.full_name', read_only=True)
    customer_code = serializers.CharField(source='customer.customer_code', read_only=True)
    loan_account_number = serializers.CharField(source='loan.loan_account_number', read_only=True)
    agent_name = serializers.CharField(source='agent.get_full_name', read_only=True)
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    submission_number = serializers.CharField(source='cash_submission.submission_number', read_only=True, default=None)

    class Meta:
        model = Collection
        fields = [
            'id', 'receipt_number', 'loan', 'loan_account_number',
            'customer', 'customer_name', 'customer_code',
            'agent', 'agent_name', 'branch', 'branch_name',
            'schedule', 'amount', 'payment_mode', 'payment_reference',
            'status', 'cash_submission', 'submission_number',
            'idempotency_key', 'notes', 'collected_at', 'created_at'
        ]
        read_only_fields = [
            'receipt_number', 'customer', 'agent', 'branch', 
            'status', 'cash_submission', 'collected_at', 'created_at'
        ]

    def validate_amount(self, value):
        if value <= Decimal('0.00'):
            raise serializers.ValidationError("Collection amount must be strictly greater than zero.")
        return value

    def validate(self, attrs):
        loan = attrs.get('loan')
        amount = attrs.get('amount')
        idempotency_key = attrs.get('idempotency_key')

        if loan and amount:
            if amount > loan.outstanding_balance:
                raise serializers.ValidationError({
                    'amount': f"Over-collection rejected. Repayment amount ₹{amount} exceeds outstanding loan balance ₹{loan.outstanding_balance}."
                })

        if idempotency_key and Collection.objects.filter(idempotency_key=idempotency_key).exists():
            raise serializers.ValidationError({
                'idempotency_key': "Duplicate collection detected. This transaction was already processed."
            })

        return attrs


class DiscrepancySerializer(serializers.ModelSerializer):
    agent_name = serializers.CharField(source='agent.get_full_name', read_only=True)
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    submission_number = serializers.CharField(source='submission.submission_number', read_only=True)
    resolved_by_name = serializers.CharField(source='resolved_by.get_full_name', read_only=True, default=None)

    class Meta:
        model = Discrepancy
        fields = [
            'id', 'submission', 'submission_number', 'agent', 'agent_name',
            'branch', 'branch_name', 'expected_amount', 'actual_amount',
            'difference', 'discrepancy_type', 'resolution_status',
            'resolution_notes', 'resolved_by', 'resolved_by_name',
            'resolved_at', 'created_at'
        ]
        read_only_fields = ['id', 'submission', 'agent', 'branch', 'expected_amount', 'actual_amount', 'difference', 'discrepancy_type', 'created_at']


class CashSubmissionSerializer(serializers.ModelSerializer):
    agent_name = serializers.CharField(source='agent.get_full_name', read_only=True)
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    reconciled_by_name = serializers.CharField(source='reconciled_by.get_full_name', read_only=True, default=None)
    collections = CollectionSerializer(many=True, read_only=True)
    discrepancies = DiscrepancySerializer(many=True, read_only=True)
    collections_count = serializers.IntegerField(source='collections.count', read_only=True)

    class Meta:
        model = CashSubmission
        fields = [
            'id', 'submission_number', 'agent', 'agent_name',
            'branch', 'branch_name', 'submission_date',
            'total_expected_amount', 'total_actual_amount', 'discrepancy_amount',
            'status', 'reconciled_by', 'reconciled_by_name', 'reconciled_at',
            'rejection_reason', 'agent_notes', 'branch_notes',
            'bank_deposit', 'collections', 'collections_count', 'discrepancies', 'created_at'
        ]
        read_only_fields = [
            'submission_number', 'agent', 'branch', 'submission_date',
            'total_expected_amount', 'total_actual_amount', 'discrepancy_amount',
            'status', 'reconciled_by', 'reconciled_at', 'created_at'
        ]


class CashSubmissionReconcileSerializer(serializers.Serializer):
    total_actual_amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal('0.00'))
    branch_notes = serializers.CharField(required=False, allow_blank=True, default='')


class CashSubmissionRejectSerializer(serializers.Serializer):
    rejection_reason = serializers.CharField(required=True, min_length=5)


class BankDepositSerializer(serializers.ModelSerializer):
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    settled_by_name = serializers.CharField(source='settled_by.get_full_name', read_only=True, default=None)
    submission_ids = serializers.ListField(
        child=serializers.IntegerField(), 
        write_only=True, 
        required=False, 
        default=list,
        help_text="Optional list of CashSubmission IDs to associate with this bank deposit slip"
    )

    class Meta:
        model = BankDeposit
        fields = [
            'id', 'deposit_slip_number', 'branch', 'branch_name',
            'bank_name', 'bank_account_number', 'deposit_date',
            'amount', 'bank_reference_number', 'status',
            'created_by', 'created_by_name', 'notes',
            'settled_at', 'settled_amount', 'settlement_variance',
            'settlement_notes', 'settled_by', 'settled_by_name',
            'submission_ids', 'created_at'
        ]
        read_only_fields = [
            'deposit_slip_number', 'status', 'created_by',
            'settled_at', 'settled_amount', 'settlement_variance',
            'settlement_notes', 'settled_by', 'created_at'
        ]

    def validate_bank_reference_number(self, value):
        if BankDeposit.objects.filter(bank_reference_number=value).exists():
            raise serializers.ValidationError(
                f"Duplicate Bank Reference rejected. A bank deposit with reference '{value}' already exists in the system."
            )
        return value

    def validate(self, attrs):
        branch = attrs.get('branch')
        amount = attrs.get('amount')
        if branch and amount:
            if amount > branch.vault_cash_balance:
                raise serializers.ValidationError({
                    'amount': f"Bank deposit amount ₹{amount} exceeds current branch vault balance ₹{branch.vault_cash_balance}."
                })
        return attrs


class BankSettlementSerializer(serializers.Serializer):
    settled_amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal('0.00'))
    settlement_notes = serializers.CharField(required=False, allow_blank=True, default='')


class AuditLogSerializer(serializers.ModelSerializer):
    actor_name = serializers.CharField(source='actor.get_full_name', read_only=True, default='SYSTEM')

    class Meta:
        model = AuditLog
        fields = ['id', 'actor', 'actor_name', 'action', 'entity_type', 'entity_id', 'details', 'ip_address', 'timestamp']
        read_only_fields = fields
