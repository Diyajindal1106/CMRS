import pytest
from decimal import Decimal
from datetime import date, timedelta
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from core.models import User, Branch, AuditLog
from loans.models import Customer, Loan, RepaymentSchedule
from collections_app.models import Collection, CashSubmission, Discrepancy
from banking.models import BankDeposit

@pytest.fixture
def api_client():
    return APIClient()

@pytest.fixture
def test_setup():
    branch = Branch.objects.create(
        code="BR-TEST-01",
        name="Test Central Branch",
        city="Mumbai",
        state="Maharashtra",
        vault_cash_balance=Decimal("50000.00")
    )

    admin = User.objects.create_superuser(
        username="test_admin",
        password="TestPassword@123",
        role=User.Role.ADMIN
    )

    bm = User.objects.create_user(
        username="test_bm",
        password="TestPassword@123",
        role=User.Role.BRANCH_MANAGER,
        branch=branch
    )

    agent = User.objects.create_user(
        username="test_agent",
        password="TestPassword@123",
        role=User.Role.COLLECTION_AGENT,
        branch=branch,
        cash_in_hand=Decimal("0.00")
    )

    customer = Customer.objects.create(
        customer_code="CUST-TEST-01",
        first_name="Rohan",
        last_name="Verma",
        phone="+919800000001",
        address="Test Road",
        assigned_agent=agent,
        branch=branch
    )

    loan = Loan.objects.create(
        loan_account_number="LN-TEST-01",
        customer=customer,
        branch=branch,
        principal_amount=Decimal("30000.00"),
        interest_rate=Decimal("12.00"),
        tenure_months=6,
        total_amount_payable=Decimal("33600.00"),
        total_amount_collected=Decimal("0.00"),
        outstanding_balance=Decimal("33600.00"),
        status=Loan.Status.ACTIVE,
        disbursed_at=date.today() - timedelta(days=30)
    )

    schedule1 = RepaymentSchedule.objects.create(
        loan=loan,
        installment_number=1,
        due_date=date.today(),
        due_amount=Decimal("5600.00"),
        paid_amount=Decimal("0.00"),
        status=RepaymentSchedule.Status.PENDING
    )

    return {
        'branch': branch,
        'admin': admin,
        'bm': bm,
        'agent': agent,
        'customer': customer,
        'loan': loan,
        'schedule1': schedule1
    }


@pytest.mark.django_db
class TestCMRSWorkflows:

    def test_partial_repayment_and_schedule_update(self, api_client, test_setup):
        """Test partial collection reduces outstanding loan balance and updates schedule to PARTIAL."""
        agent = test_setup['agent']
        loan = test_setup['loan']
        api_client.force_authenticate(user=agent)

        response = api_client.post('/api/collections/', {
            'loan': loan.id,
            'amount': '2000.00',
            'payment_mode': 'CASH',
            'idempotency_key': 'KEY-PARTIAL-01',
            'notes': 'Partial installment payment'
        })

        assert response.status_code == status.HTTP_201_CREATED
        loan.refresh_from_db()
        assert loan.total_amount_collected == Decimal('2000.00')
        assert loan.outstanding_balance == Decimal('31600.00')

        sched = loan.schedules.get(installment_number=1)
        assert sched.paid_amount == Decimal('2000.00')
        assert sched.status == RepaymentSchedule.Status.PARTIAL

        agent.refresh_from_db()
        assert agent.cash_in_hand == Decimal('2000.00')

    def test_over_collection_prevention(self, api_client, test_setup):
        """Test system prevents collecting more than the loan's outstanding balance."""
        agent = test_setup['agent']
        loan = test_setup['loan']
        api_client.force_authenticate(user=agent)

        excessive_amount = loan.outstanding_balance + Decimal('500.00')
        response = api_client.post('/api/collections/', {
            'loan': loan.id,
            'amount': str(excessive_amount),
            'payment_mode': 'CASH',
            'idempotency_key': 'KEY-OVERCOLLECT-01'
        })

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'Over-collection rejected' in str(response.data)

    def test_duplicate_collection_prevention(self, api_client, test_setup):
        """Test idempotency prevents duplicate recording of identical collection request."""
        agent = test_setup['agent']
        loan = test_setup['loan']
        api_client.force_authenticate(user=agent)

        payload = {
            'loan': loan.id,
            'amount': '1500.00',
            'payment_mode': 'CASH',
            'idempotency_key': 'KEY-IDEMP-DUPLICATE-TEST'
        }

        first_res = api_client.post('/api/collections/', payload)
        assert first_res.status_code == status.HTTP_201_CREATED

        # Duplicate attempt with same idempotency key
        duplicate_res = api_client.post('/api/collections/', payload)
        assert duplicate_res.status_code == status.HTTP_400_BAD_REQUEST
        assert 'already exists' in str(duplicate_res.data) or 'Duplicate' in str(duplicate_res.data)

    def test_branch_reconciliation_with_discrepancy(self, api_client, test_setup):
        """
        Test business scenario from prompt:
        Expected: ₹50,000, Received: ₹48,500, Difference: -₹1,500
        Verified by Branch Manager, automatically creates Discrepancy record.
        """
        agent = test_setup['agent']
        bm = test_setup['bm']
        branch = test_setup['branch']
        loan = test_setup['loan']

        # Agent submits cash batch
        col1 = Collection.objects.create(
            receipt_number="REC-DISC-01",
            loan=loan,
            customer=loan.customer,
            agent=agent,
            branch=branch,
            amount=Decimal("50000.00"),
            payment_mode=Collection.PaymentMode.CASH,
            status=Collection.Status.COLLECTED,
            idempotency_key="KEY-DISC-BATCH"
        )
        agent.cash_in_hand = Decimal("50000.00")
        agent.save()

        api_client.force_authenticate(user=agent)
        sub_res = api_client.post('/api/collections/submit_batch/', {
            'collection_ids': [col1.id],
            'agent_notes': 'Full batch handover'
        })
        assert sub_res.status_code == status.HTTP_201_CREATED
        submission_id = sub_res.data['id']

        # Branch Manager reconciles with physical count of ₹48,500
        api_client.force_authenticate(user=bm)
        rec_res = api_client.post(f'/api/submissions/{submission_id}/reconcile/', {
            'total_actual_amount': '48500.00',
            'branch_notes': '₹1500 shortage identified during physical count'
        })

        assert rec_res.status_code == status.HTTP_200_OK
        sub_obj = CashSubmission.objects.get(id=submission_id)
        assert sub_obj.status == CashSubmission.Status.RECONCILED
        assert sub_obj.discrepancy_amount == Decimal('-1500.00')

        # Check Discrepancy model
        discrepancy = Discrepancy.objects.get(submission=sub_obj)
        assert discrepancy.discrepancy_type == Discrepancy.DiscrepancyType.SHORTAGE
        assert discrepancy.difference == Decimal('-1500.00')
        assert discrepancy.resolution_status == Discrepancy.ResolutionStatus.OPEN

        # Collections under submission marked RECONCILED
        col1.refresh_from_db()
        assert col1.status == Collection.Status.RECONCILED

    def test_rejected_cash_submission_reverts_collections(self, api_client, test_setup):
        """Test rejected cash submission returns collections to COLLECTED status."""
        agent = test_setup['agent']
        bm = test_setup['bm']
        branch = test_setup['branch']
        loan = test_setup['loan']

        col = Collection.objects.create(
            receipt_number="REC-REJECT-01",
            loan=loan,
            customer=loan.customer,
            agent=agent,
            branch=branch,
            amount=Decimal("5000.00"),
            payment_mode=Collection.PaymentMode.CASH,
            status=Collection.Status.COLLECTED,
            idempotency_key="KEY-REJECT-01"
        )

        api_client.force_authenticate(user=agent)
        sub_res = api_client.post('/api/collections/submit_batch/', {'collection_ids': [col.id]})
        submission_id = sub_res.data['id']

        # Branch Manager rejects with reason
        api_client.force_authenticate(user=bm)
        rej_res = api_client.post(f'/api/submissions/{submission_id}/reject/', {
            'rejection_reason': 'Mutilated currency notes in collection packet.'
        })

        assert rej_res.status_code == status.HTTP_200_OK
        sub_obj = CashSubmission.objects.get(id=submission_id)
        assert sub_obj.status == CashSubmission.Status.REJECTED

        col.refresh_from_db()
        assert col.status == Collection.Status.COLLECTED
        assert col.cash_submission is None

    def test_duplicate_bank_reference_prevention(self, api_client, test_setup):
        """Test system forbids reusing identical UTR / Challan bank reference."""
        bm = test_setup['bm']
        branch = test_setup['branch']
        api_client.force_authenticate(user=bm)

        payload = {
            'branch': branch.id,
            'bank_name': 'HDFC Bank',
            'bank_account_number': '50200012345678',
            'deposit_date': str(date.today()),
            'amount': '10000.00',
            'bank_reference_number': 'UTR-UNIQUE-TEST-001',
            'notes': 'First deposit'
        }

        first_dep = api_client.post('/api/bank-deposits/', payload)
        assert first_dep.status_code == status.HTTP_201_CREATED

        # Duplicate bank ref attempt
        dup_payload = payload.copy()
        dup_payload['amount'] = '5000.00'
        dup_res = api_client.post('/api/bank-deposits/', dup_payload)
        assert dup_res.status_code == status.HTTP_400_BAD_REQUEST
        assert 'already exists' in str(dup_res.data) or 'Duplicate' in str(dup_res.data)

    def test_bank_settlement_mismatch_detection(self, api_client, test_setup):
        """Test bank settlement variance triggers SETTLEMENT_MISMATCH status."""
        admin = test_setup['admin']
        branch = test_setup['branch']
        api_client.force_authenticate(user=admin)

        deposit = BankDeposit.objects.create(
            deposit_slip_number="DEP-MISMATCH-01",
            branch=branch,
            bank_name="SBI Bank",
            bank_account_number="1234567890",
            deposit_date=date.today(),
            amount=Decimal("50000.00"),
            bank_reference_number="SBI-REF-MISMATCH-99",
            status=BankDeposit.Status.DEPOSITED,
            created_by=admin
        )

        # Bank credited ₹49,850 instead of ₹50,000
        settle_res = api_client.post(f'/api/bank-deposits/{deposit.id}/settle/', {
            'settled_amount': '49850.00',
            'settlement_notes': 'Discrepancy of ₹150 due to counterfeit note deduction.'
        })

        assert settle_res.status_code == status.HTTP_200_OK
        deposit.refresh_from_db()
        assert deposit.status == BankDeposit.Status.SETTLEMENT_MISMATCH
        assert deposit.settlement_variance == Decimal('-150.00')

    def test_immutability_of_reconciled_transactions(self, api_client, test_setup):
        """Test reconciled or settled transactions cannot be altered or deleted."""
        agent = test_setup['agent']
        branch = test_setup['branch']
        loan = test_setup['loan']

        reconciled_col = Collection.objects.create(
            receipt_number="REC-IMMUTABLE-01",
            loan=loan,
            customer=loan.customer,
            agent=agent,
            branch=branch,
            amount=Decimal("5000.00"),
            payment_mode=Collection.PaymentMode.CASH,
            status=Collection.Status.RECONCILED,
            idempotency_key="KEY-IMMUTABLE-01"
        )

        api_client.force_authenticate(user=agent)
        # Attempt modification
        update_res = api_client.patch(f'/api/collections/{reconciled_col.id}/', {'amount': '6000.00'})
        assert update_res.status_code == status.HTTP_403_FORBIDDEN
        assert 'Unauthorized modification' in str(update_res.data)

        # Attempt deletion
        del_res = api_client.delete(f'/api/collections/{reconciled_col.id}/')
        assert del_res.status_code == status.HTTP_400_BAD_REQUEST
