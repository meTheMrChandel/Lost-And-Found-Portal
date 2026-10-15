"""
accounts/permissions.py — Role-based access control permission classes.
"""

from rest_framework.permissions import BasePermission


class IsNotBanned(BasePermission):
    """
    Blocks banned users from performing any actions.
    """
    message = "Your account has been suspended by campus administration."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and not getattr(request.user, "is_banned", False)
        )


class IsStudentUser(BasePermission):
    """
    Grants access to active, verified, non-banned students.
    """
    message = "Access restricted to active students."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and not request.user.is_banned
            and request.user.is_active
        )


class IsCampusAdmin(BasePermission):
    """
    Grants access strictly to verified campus staff / administrators.
    """
    message = "Administrative privileges required to access this resource."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (request.user.is_staff or request.user.is_superuser)
            and not request.user.is_banned
        )


class IsOwnerOrAdmin(BasePermission):
    """
    Allows read/write permissions to object author/owner or campus admins.
    """
    def has_object_permission(self, request, view, obj):
        if not (request.user and request.user.is_authenticated):
            return False

        if request.user.is_staff or request.user.is_superuser:
            return True

        # Check for typical ownership fields on models
        owner = getattr(obj, "author", None) or getattr(obj, "owner", None) or getattr(obj, "user", None)
        return owner == request.user
