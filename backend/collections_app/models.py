from django.db import models
from django.conf import settings
from decimal import Decimal
from core.models import Branch

class CashSubmission(models.Model):
    """
    A batch of cash collections submitted by a collection agent to their branch.
    Undergoes physical verification and reconciliation by the Branch Manager.
    """
    class Status(models.TextChoices):
        PENDING_APPROVAL = 'PENDING_APPROVAL', 'Pending Branch Approval'
        RECONCILED = 'RECONCILED', 'Reconciled & Accepted into Vault'
        REJECTED = 'REJECTED', 'Rejected by Branch'
        BANK_DEPOSITED = 'BANK_DEPOSITED', 'Deposited to Bank'

    submission_number = models.CharField(max_length=40, unique=True, help_text="e.g. SUB-20261009-001")
    agent = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='cash_submissions'
    )
    branch = models.ForeignKey(
        Branch,
        on_delete=models.PROTECT,
        related_name='cash_submissions'
    )
    submission_date = models.DateTimeField(auto_now_add=True)
    total_expected_amount = models.DecimalField(
        max_digits=12, 
        decimal_places=2,
        help_text="Sum of all collection receipts in this submission"
    )
    total_actual_amount = models.DecimalField(
        max_digits=12, 
        decimal_places=2, 
        null=True, 
        blank=True,
        help_text="Physical cash counted and received by branch cashier/manager"
    )
    discrepancy_amount = models.DecimalField(
        max_digits=12, 
        decimal_places=2, 
        default=Decimal('0.00'),
        help_text="actual_amount - expected_amount (negative = shortage, positive = excess)"
    )
    status = models.CharField(
        max_length=25, 
        choices=Status.choices, 
        default=Status.PENDING_APPROVAL
    )
    reconciled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reconciled_submissions'
    )
    reconciled_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)
    agent_notes = models.TextField(blank=True)
    branch_notes = models.TextField(blank=True)
    bank_deposit = models.ForeignKey(
        'banking.BankDeposit',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='cash_submissions'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-submission_date']

    def __str__(self):
        return f"{self.submission_number} - {self.agent.get_full_name()} -> {self.branch.name} (Exp: ₹{self.total_expected_amount})"


class Collection(models.Model):
    """
    Individual repayment transaction collected by a field agent from a customer.
    Follows lifecycle: Expected -> Collected -> Branch Received (Reconciled) -> Bank Deposited -> Settled.
    """
    class PaymentMode(models.TextChoices):
        CASH = 'CASH', 'Cash'
        UPI_SANDBOX = 'UPI_SANDBOX', 'UPI / Digital Payment (Sandbox)'

    class Status(models.TextChoices):
        COLLECTED = 'COLLECTED', 'Collected by Agent (Cash in Hand)'
        SUBMITTED = 'SUBMITTED', 'Submitted to Branch (Pending Verification)'
        RECONCILED = 'RECONCILED', 'Branch Received & Reconciled'
        BANK_DEPOSITED = 'BANK_DEPOSITED', 'Bank Deposited'
        SETTLED = 'SETTLED', 'Settled & Reconciled at Bank'
        CANCELLED = 'CANCELLED', 'Cancelled'

    receipt_number = models.CharField(max_length=40, unique=True, help_text="e.g. REC-20261009-8472")
    loan = models.ForeignKey(
        'loans.Loan',
        on_delete=models.PROTECT,
        related_name='collections'
    )
    customer = models.ForeignKey(
        'loans.Customer',
        on_delete=models.PROTECT,
        related_name='collections'
    )
    agent = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='collected_payments'
    )
    branch = models.ForeignKey(
        Branch,
        on_delete=models.PROTECT,
        related_name='collections'
    )
    schedule = models.ForeignKey(
        'loans.RepaymentSchedule',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='collections'
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    payment_mode = models.CharField(max_length=20, choices=PaymentMode.choices, default=PaymentMode.CASH)
    payment_reference = models.CharField(max_length=100, blank=True, help_text="UPI Ref / Sandbox Transaction ID")
    status = models.CharField(max_length=25, choices=Status.choices, default=Status.COLLECTED)
    cash_submission = models.ForeignKey(
        CashSubmission,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='collections'
    )
    idempotency_key = models.CharField(
        max_length=100, 
        unique=True, 
        help_text="Unique client token to guarantee no duplicate collections"
    )
    notes = models.TextField(blank=True)
    collected_at = models.DateTimeField(auto_now_add=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-collected_at']

    def __str__(self):
        return f"{self.receipt_number} - {self.customer.full_name} - ₹{self.amount} ({self.get_status_display()})"


class Discrepancy(models.Model):
    """
    Tracks collection shortages or excesses flagged during physical branch reconciliation.
    """
    class DiscrepancyType(models.TextChoices):
        SHORTAGE = 'SHORTAGE', 'Cash Shortage (Physical < Expected)'
        EXCESS = 'EXCESS', 'Cash Excess (Physical > Expected)'

    class ResolutionStatus(models.TextChoices):
        OPEN = 'OPEN', 'Open (Unresolved)'
        INVESTIGATING = 'INVESTIGATING', 'Under Investigation'
        RECOVERED = 'RECOVERED', 'Recovered from Agent'
        WRITTEN_OFF = 'WRITTEN_OFF', 'Approved Write-Off'
        RESOLVED = 'RESOLVED', 'Resolved & Cleared'

    submission = models.ForeignKey(
        CashSubmission,
        on_delete=models.CASCADE,
        related_name='discrepancies'
    )
    agent = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='discrepancies'
    )
    branch = models.ForeignKey(
        Branch,
        on_delete=models.PROTECT,
        related_name='discrepancies'
    )
    expected_amount = models.DecimalField(max_digits=12, decimal_places=2)
    actual_amount = models.DecimalField(max_digits=12, decimal_places=2)
    difference = models.DecimalField(
        max_digits=12, 
        decimal_places=2, 
        help_text="actual - expected"
    )
    discrepancy_type = models.CharField(max_length=20, choices=DiscrepancyType.choices)
    resolution_status = models.CharField(
        max_length=20, 
        choices=ResolutionStatus.choices, 
        default=ResolutionStatus.OPEN
    )
    resolution_notes = models.TextField(blank=True)
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='resolved_discrepancies'
    )
    resolved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Discrepancy #{self.id} on {self.submission.submission_number}: {self.discrepancy_type} ₹{abs(self.difference)}"
