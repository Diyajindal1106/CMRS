from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from api.views import (
    CMRSTokenObtainPairView, me_view, demo_users_view,
    BranchViewSet, CustomerViewSet, LoanViewSet,
    CollectionViewSet, CashSubmissionViewSet, DiscrepancyViewSet,
    BankDepositViewSet, DashboardAnalyticsView, AuditLogViewSet
)

router = DefaultRouter()
router.register(r'branches', BranchViewSet, basename='branch')
router.register(r'customers', CustomerViewSet, basename='customer')
router.register(r'loans', LoanViewSet, basename='loan')
router.register(r'collections', CollectionViewSet, basename='collection')
router.register(r'submissions', CashSubmissionViewSet, basename='submission')
router.register(r'discrepancies', DiscrepancyViewSet, basename='discrepancy')
router.register(r'bank-deposits', BankDepositViewSet, basename='bank-deposit')
router.register(r'audit-logs', AuditLogViewSet, basename='audit-log')

urlpatterns = [
    # Auth endpoints
    path('auth/login/', CMRSTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/me/', me_view, name='me'),
    path('auth/demo-users/', demo_users_view, name='demo_users'),

    # Executive Analytics & Reporting
    path('dashboard/analytics/', DashboardAnalyticsView.as_view(), name='dashboard_analytics'),

    # ViewSet routes
    path('', include(router.urls)),
]
