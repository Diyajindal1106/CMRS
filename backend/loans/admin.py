from django.contrib import admin
from loans.models import Customer, Loan, RepaymentSchedule

@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ('customer_code', 'first_name', 'last_name', 'phone', 'branch', 'assigned_agent')
    search_fields = ('customer_code', 'first_name', 'last_name', 'phone', 'national_id')
    list_filter = ('branch', 'assigned_agent')

class RepaymentScheduleInline(admin.TabularInline):
    model = RepaymentSchedule
    extra = 0
    readonly_fields = ('installment_number', 'due_date', 'due_amount', 'paid_amount', 'status')

@admin.register(Loan)
class LoanAdmin(admin.ModelAdmin):
    list_display = ('loan_account_number', 'customer', 'branch', 'principal_amount', 'total_amount_payable', 'outstanding_balance', 'status')
    search_fields = ('loan_account_number', 'customer__first_name', 'customer__last_name', 'customer__customer_code')
    list_filter = ('status', 'branch')
    inlines = [RepaymentScheduleInline]

@admin.register(RepaymentSchedule)
class RepaymentScheduleAdmin(admin.ModelAdmin):
    list_display = ('loan', 'installment_number', 'due_date', 'due_amount', 'paid_amount', 'status')
    list_filter = ('status', 'due_date')
    search_fields = ('loan__loan_account_number',)
