from rest_framework import permissions
from core.models import User

class IsAdminOrFinance(permissions.BasePermission):
    """
    Allows access only to Super Admins and Finance Controllers.
    """
    def has_permission(self, request, view):
        return (
            request.user and 
            request.user.is_authenticated and 
            request.user.is_admin_or_finance
        )


class IsBranchManager(permissions.BasePermission):
    """
    Allows access to Branch Managers and Admins.
    """
    def has_permission(self, request, view):
        return (
            request.user and 
            request.user.is_authenticated and 
            (request.user.is_branch_manager or request.user.is_admin_or_finance)
        )


class IsCollectionAgent(permissions.BasePermission):
    """
    Allows access to Collection Agents and Admins.
    """
    def has_permission(self, request, view):
        return (
            request.user and 
            request.user.is_authenticated and 
            (request.user.is_collection_agent or request.user.is_admin_or_finance)
        )


class RoleBasedAccessPermission(permissions.BasePermission):
    """
    General RBAC permission checking if user has an active authenticated account.
    """
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated
