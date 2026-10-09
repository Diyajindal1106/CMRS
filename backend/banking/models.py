from django.db import models
from django.conf import settings
from decimal import Decimal
from core.models import Branch

class BankDeposit(models.Model):
    """
    Branch manager deposits verified cash from the branch vault into the company's bank account.
    """
    class Status(models.TextChoices):
        DEPOSITED = 'DEPOSITED', 'Deposited at Bank (Pending Settlement)'
        SETTLED = 'SETTLED', 'Settled & Verified by Bank'
        SETTLEMENT_MISMATCH = 'SETTLEMENT_MISMATCH', 'Settlement Mismatch'
        FAILED = 'FAILED', 'Deposit Bounced / Failed'

    deposit_slip_number = models.CharField(max_length=40, unique=True, help_text="e.g. DEP-20261009-001")
    branch = models.ForeignKey(
        Branch,
        on_delete=models.CASCADE,
        related_name='bank_deposits'
    )
    bank_name = models.CharField(max_length=100, help_text="e.g. HDFC Bank, SBI, ICICI")
    bank_account_number = models.CharField(max_length=50)
    deposit_date = models.DateField()
    amount = models.DecimalField(max_digits=12, decimal_places=2, help_text="Physical cash amount deposited")
    bank_reference_number = models.CharField(
        max_length=100, 
        unique=True, 
        help_text="Unique UTR, Challan, or Teller reference number from bank"
    )
    status = models.CharField(
        max_length=25, 
        choices=Status.choices, 
        default=Status.DEPOSITED
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='created_deposits'
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    # Bank Settlement fields
    settled_at = models.DateTimeField(null=True, blank=True)
    settled_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    settlement_variance = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    settlement_notes = models.TextField(blank=True)
    settled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='settled_deposits'
    )

    class Meta:
        ordering = ['-deposit_date', '-created_at']

    def __str__(self):
        return f"{self.deposit_slip_number} - {self.branch.name} - ₹{self.amount} ({self.get_status_display()})"
