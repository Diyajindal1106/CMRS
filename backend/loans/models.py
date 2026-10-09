from django.db import models
from django.conf import settings
from decimal import Decimal
from core.models import Branch

class Customer(models.Model):
    """
    Borrower whose repayments are collected by field agents.
    """
    customer_code = models.CharField(max_length=30, unique=True, help_text="e.g. CUST-1001")
    first_name = models.CharField(max_length=60)
    last_name = models.CharField(max_length=60)
    phone = models.CharField(max_length=20)
    email = models.EmailField(blank=True)
    address = models.TextField()
    national_id = models.CharField(max_length=50, blank=True, help_text="National ID / PAN / Aadhaar")
    assigned_agent = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_customers'
    )
    branch = models.ForeignKey(
        Branch,
        on_delete=models.CASCADE,
        related_name='customers'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['customer_code']

    def __str__(self):
        return f"{self.customer_code} - {self.first_name} {self.last_name}"

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip()


class Loan(models.Model):
    """
    Loan account with scheduled installments and outstanding balance.
    """
    class Status(models.TextChoices):
        ACTIVE = 'ACTIVE', 'Active'
        CLOSED = 'CLOSED', 'Fully Paid / Closed'
        DEFAULTED = 'DEFAULTED', 'Defaulted'
        WRITTEN_OFF = 'WRITTEN_OFF', 'Written Off'

    loan_account_number = models.CharField(max_length=40, unique=True, help_text="e.g. LN-2026-001")
    customer = models.ForeignKey(
        Customer,
        on_delete=models.CASCADE,
        related_name='loans'
    )
    branch = models.ForeignKey(
        Branch,
        on_delete=models.CASCADE,
        related_name='loans'
    )
    principal_amount = models.DecimalField(max_digits=12, decimal_places=2)
    interest_rate = models.DecimalField(max_digits=5, decimal_places=2, help_text="Annual Interest Rate (%)")
    tenure_months = models.PositiveIntegerField(help_text="Repayment tenure in months")
    total_amount_payable = models.DecimalField(max_digits=12, decimal_places=2)
    total_amount_collected = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    outstanding_balance = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    disbursed_at = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.loan_account_number} ({self.customer.full_name}) - Bal: {self.outstanding_balance}"

    def apply_repayment(self, amount: Decimal):
        """
        Deducts payment from outstanding balance and marks closed if zero.
        """
        self.total_amount_collected += amount
        self.outstanding_balance = max(Decimal('0.00'), self.outstanding_balance - amount)
        if self.outstanding_balance == Decimal('0.00'):
            self.status = self.Status.CLOSED
        self.save()


class RepaymentSchedule(models.Model):
    """
    Installment / EMI schedule for a loan.
    """
    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        PARTIAL = 'PARTIAL', 'Partially Paid'
        PAID = 'PAID', 'Fully Paid'
        OVERDUE = 'OVERDUE', 'Overdue'

    loan = models.ForeignKey(
        Loan,
        on_delete=models.CASCADE,
        related_name='schedules'
    )
    installment_number = models.PositiveIntegerField()
    due_date = models.DateField()
    due_amount = models.DecimalField(max_digits=12, decimal_places=2)
    paid_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)

    class Meta:
        ordering = ['loan', 'installment_number']
        unique_together = ('loan', 'installment_number')

    def __str__(self):
        return f"{self.loan.loan_account_number} - Inst #{self.installment_number} (Due: {self.due_amount}, Paid: {self.paid_amount})"

    @property
    def remaining_amount(self):
        return max(Decimal('0.00'), self.due_amount - self.paid_amount)
