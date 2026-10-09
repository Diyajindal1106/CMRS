from django.contrib import admin
from collections_app.models import Collection, CashSubmission, Discrepancy

@admin.register(Collection)
class CollectionAdmin(admin.ModelAdmin):
    list_display = ('receipt_number', 'customer', 'loan', 'agent', 'branch', 'amount', 'payment_mode', 'status', 'collected_at')
    search_fields = ('receipt_number', 'customer__first_name', 'customer__last_name', 'customer__customer_code', 'loan__loan_account_number')
    list_filter = ('status', 'payment_mode', 'branch')
    readonly_fields = ('idempotency_key', 'collected_at', 'created_at')

class CollectionInline(admin.TabularInline):
    model = Collection
    extra = 0
    fields = ('receipt_number', 'customer', 'amount', 'status')
    readonly_fields = ('receipt_number', 'customer', 'amount', 'status')

@admin.register(CashSubmission)
class CashSubmissionAdmin(admin.ModelAdmin):
    list_display = ('submission_number', 'agent', 'branch', 'total_expected_amount', 'total_actual_amount', 'discrepancy_amount', 'status', 'submission_date')
    search_fields = ('submission_number', 'agent__username', 'agent__first_name')
    list_filter = ('status', 'branch')
    inlines = [CollectionInline]

@admin.register(Discrepancy)
class DiscrepancyAdmin(admin.ModelAdmin):
    list_display = ('id', 'submission', 'agent', 'branch', 'expected_amount', 'actual_amount', 'difference', 'discrepancy_type', 'resolution_status', 'created_at')
    list_filter = ('discrepancy_type', 'resolution_status', 'branch')
    search_fields = ('submission__submission_number', 'agent__username')
