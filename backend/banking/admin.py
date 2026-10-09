from django.contrib import admin
from banking.models import BankDeposit

@admin.register(BankDeposit)
class BankDepositAdmin(admin.ModelAdmin):
    list_display = ('deposit_slip_number', 'branch', 'bank_name', 'amount', 'bank_reference_number', 'deposit_date', 'status', 'settled_amount', 'settlement_variance')
    list_filter = ('status', 'bank_name', 'branch', 'deposit_date')
    search_fields = ('deposit_slip_number', 'bank_reference_number', 'branch__name')
    readonly_fields = ('created_at', 'settled_at')
