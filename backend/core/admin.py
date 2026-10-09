from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from core.models import User, Branch, AuditLog

@admin.register(Branch)
class BranchAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'city', 'state', 'vault_cash_balance', 'is_active')
    search_fields = ('code', 'name', 'city')
    list_filter = ('city', 'state', 'is_active')

@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ('username', 'email', 'role', 'branch', 'employee_id', 'cash_in_hand', 'is_active')
    list_filter = ('role', 'branch', 'is_active')
    fieldsets = BaseUserAdmin.fieldsets + (
        ('Fintech / CMRS Profile', {'fields': ('role', 'branch', 'employee_id', 'phone_number', 'cash_in_hand')}),
    )

@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ('timestamp', 'actor', 'action', 'entity_type', 'entity_id', 'ip_address')
    list_filter = ('action', 'entity_type')
    search_fields = ('entity_id', 'action')
    readonly_fields = ('actor', 'action', 'entity_type', 'entity_id', 'details', 'ip_address', 'timestamp')
