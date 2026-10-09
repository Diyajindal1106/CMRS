from django.db import models
from django.contrib.auth.models import AbstractUser
from decimal import Decimal

class Branch(models.Model):
    """
    Physical branch where field agents deposit collected cash
    and branch managers initiate bank deposits.
    """
    code = models.CharField(max_length=20, unique=True, help_text="Unique branch identifier (e.g. BR-MUM-01)")
    name = models.CharField(max_length=100)
    city = models.CharField(max_length=50)
    state = models.CharField(max_length=50)
    address = models.TextField(blank=True)
    contact_number = models.CharField(max_length=20, blank=True)
    vault_cash_balance = models.DecimalField(
        max_digits=14, 
        decimal_places=2, 
        default=Decimal('0.00'),
        help_text="Reconciled cash physically in branch vault pending bank deposit"
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "Branches"
        ordering = ['code']

    def __str__(self):
        return f"{self.code} - {self.name} ({self.city})"


class User(AbstractUser):
    """
    Custom user model with RBAC for Admin, Finance Controller, Branch Manager, and Collection Agent.
    """
    class Role(models.TextChoices):
        ADMIN = 'ADMIN', 'Super Admin'
        FINANCE_CONTROLLER = 'FINANCE_CONTROLLER', 'Finance Controller'
        BRANCH_MANAGER = 'BRANCH_MANAGER', 'Branch Manager'
        COLLECTION_AGENT = 'COLLECTION_AGENT', 'Collection Agent'

    role = models.CharField(
        max_length=25, 
        choices=Role.choices, 
        default=Role.COLLECTION_AGENT
    )
    branch = models.ForeignKey(
        Branch, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='users',
        help_text="Assigned branch (applicable for Branch Managers and Collection Agents)"
    )
    employee_id = models.CharField(max_length=30, unique=True, null=True, blank=True)
    phone_number = models.CharField(max_length=20, blank=True)
    cash_in_hand = models.DecimalField(
        max_digits=12, 
        decimal_places=2, 
        default=Decimal('0.00'),
        help_text="Total cash currently in agent's physical possession pending branch handover"
    )

    class Meta:
        ordering = ['username']

    def __str__(self):
        return f"{self.get_full_name() or self.username} ({self.get_role_display()})"

    @property
    def is_admin_or_finance(self):
        return self.role in [self.Role.ADMIN, self.Role.FINANCE_CONTROLLER] or self.is_superuser

    @property
    def is_branch_manager(self):
        return self.role == self.Role.BRANCH_MANAGER

    @property
    def is_collection_agent(self):
        return self.role == self.Role.COLLECTION_AGENT


class AuditLog(models.Model):
    """
    Immutable audit trail for financial transactions, status changes, and reconciliation events.
    """
    actor = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='audit_logs'
    )
    action = models.CharField(max_length=60)
    entity_type = models.CharField(max_length=60)
    entity_id = models.CharField(max_length=60)
    details = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        actor_name = self.actor.username if self.actor else 'SYSTEM'
        return f"[{self.timestamp.strftime('%Y-%m-%d %H:%M:%S')}] {actor_name} -> {self.action} on {self.entity_type} #{self.entity_id}"
