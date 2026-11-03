"""
notifications/events.py — Who gets told what when a report or match changes.

Each function is called once by the view that performs the change, so every event
produces exactly one notification per recipient.
"""

from django.utils import timezone

from apps.accounts.models import User
from apps.notifications.models import Notification
from apps.notifications.services import create_notification

NotifType = Notification.NotifType


def notify_admins_new_report(post) -> None:
    """In-app only: the review-SLA alert already emails admins about reports left waiting."""
    kind = "lost" if post.post_type == post.PostType.LOST else "found"
    admins = User.objects.filter(is_staff=True, is_active=True, is_banned=False).exclude(pk=post.author_id)
    for admin in admins:
        create_notification(
            recipient=admin,
            notif_type=NotifType.GENERAL,
            title=f"New {kind} report to review",
            body=f'"{post.title}" was submitted and is waiting in the case queue.',
            data={"post_id": str(post.id)},
            send_email_copy=False,
        )


def notify_author_of_review(post, action: str, remarks: str) -> None:
    """Tell the author what an admin decided about their report."""
    reason = f"\n\nAdmin note: {remarks}" if remarks else ""
    # Approval starts the expiry timer, so say how long the post stays up
    listed_until = (
        f" It stays listed until {timezone.localtime(post.expires_at):%d %b %Y} unless you renew it."
        if post.expires_at
        else ""
    )
    messages = {
        "APPROVE": (
            NotifType.POST_APPROVED,
            "Your report is live",
            f'"{post.title}" was approved and is now on the campus feed.{listed_until}{reason}',
        ),
        "REJECT": (
            NotifType.POST_REJECTED,
            "Your report was not approved",
            f'"{post.title}" was rejected.{reason}',
        ),
        "INFO_REQUESTED": (
            NotifType.INFO_REQUESTED,
            "More information needed",
            f'An admin needs more details about "{post.title}". '
            f"Update the report from My Reports to send it back for review.{reason}",
        ),
        "HIDE": (
            NotifType.GENERAL,
            "Your report was hidden",
            f'"{post.title}" was hidden from the campus feed by an admin.{reason}',
        ),
        # Sent before the post is deleted, so it can still name the report
        "DELETE": (
            NotifType.GENERAL,
            "Your report was removed",
            f'"{post.title}" was removed from the portal by an admin.{reason}',
        ),
    }
    if action not in messages or post.author is None:
        return
    notif_type, title, body = messages[action]
    create_notification(
        recipient=post.author,
        notif_type=notif_type,
        title=title,
        body=body,
        data={"post_id": str(post.id), "action": action},
    )


def notify_match_confirmed(match) -> None:
    lost, found = match.lost_post, match.found_post
    create_notification(
        recipient=lost.author,
        notif_type=NotifType.MATCH_FOUND,
        title="A possible match for your lost item",
        body=f'A found item may be your "{lost.title}". An admin will check your hidden proof before any handover.',
        data={"match_id": str(match.id), "post_id": str(lost.id)},
    )
    create_notification(
        recipient=found.author,
        notif_type=NotifType.MATCH_FOUND,
        title="Someone may own the item you found",
        body=f'An admin is verifying the owner of "{found.title}" and will contact you about the handover.',
        data={"match_id": str(match.id), "post_id": str(found.id)},
    )


def notify_handover_ready(match) -> None:
    # The code itself is handed over by the admin, never sent by notification or email
    lost = match.lost_post
    create_notification(
        recipient=lost.author,
        notif_type=NotifType.HANDOVER_READY,
        title="Your item is ready for handover",
        body=f'Ownership of "{lost.title}" is verified. The admin will give you a one-time handover code to collect it.',
        data={"match_id": str(match.id), "post_id": str(lost.id)},
    )


def notify_case_closed(match) -> None:
    lost, found = match.lost_post, match.found_post
    reward = match.reward_amount_settled or 0
    reward_line = f" A reward of ₹{reward} was recorded for the finder." if reward else ""
    create_notification(
        recipient=lost.author,
        notif_type=NotifType.REWARD_RECORDED,
        title="Case closed: item returned",
        body=f'"{lost.title}" is marked returned.{reward_line}',
        data={"match_id": str(match.id), "post_id": str(lost.id)},
    )
    create_notification(
        recipient=found.author,
        notif_type=NotifType.REWARD_RECORDED,
        title="Thank you for returning an item",
        body=f'"{found.title}" was handed back to its owner.'
        + (f" A reward of ₹{reward} was recorded for you." if reward else ""),
        data={"match_id": str(match.id), "post_id": str(found.id)},
    )


def notify_admins_abuse_report(report, auto_hidden: bool) -> None:
    """In-app for every report; an auto-hide is urgent enough to email as well."""
    post = report.post
    if auto_hidden:
        title = f'Post hidden after {post.abuse_reports.count()} abuse reports'
        body = f'"{post.title}" was hidden automatically. Review it in Abuse Reports and restore or remove it.'
    else:
        title = "New abuse report"
        body = f'"{post.title}" was reported as {report.get_reason_display().lower()}.'
    admins = User.objects.filter(is_staff=True, is_active=True, is_banned=False)
    for admin in admins:
        create_notification(
            recipient=admin,
            notif_type=NotifType.GENERAL,
            title=title,
            body=body,
            data={"post_id": str(post.id), "abuse_report_id": str(report.id)},
            send_email_copy=auto_hidden,
        )


def notify_author_auto_hidden(post) -> None:
    if post.author is None:
        return
    create_notification(
        recipient=post.author,
        notif_type=NotifType.GENERAL,
        title="Your report was hidden for review",
        body=f'"{post.title}" was reported by several users and is hidden until an admin reviews it.',
        data={"post_id": str(post.id)},
    )


def notify_assignee(post, assignee, assigned_by, remarks: str) -> None:
    note = f"\n\nNote from {assigned_by.full_name or assigned_by.email}: {remarks}" if remarks else ""
    create_notification(
        recipient=assignee,
        notif_type=NotifType.GENERAL,
        title="A case was assigned to you",
        body=f'{assigned_by.full_name or assigned_by.email} assigned "{post.title}" to you in the case queue.{note}',
        data={"post_id": str(post.id)},
    )
