from datetime import timedelta
from django.conf import settings
from django.core.mail import send_mail
from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from game.models import Invitation


class Command(BaseCommand):
    help = "Deliver pending invitations. Run once a minute on the API host."

    def handle(self, *args, **kwargs):
        for _ in range(100):
            now = timezone.now()
            with transaction.atomic():
                invite = (
                    Invitation.objects.select_for_update()
                    .select_related("challenge__host")
                    .filter(
                        delivered=False,
                        declined=False,
                        started=None,
                        challenge__deadline__gt=now,
                    )
                    .filter(
                        Q(sent_at=None) | Q(sent_at__lt=now - timedelta(minutes=10))
                    )
                    .order_by("sent_at")
                    .first()
                )
                if not invite:
                    return
                invite.sent_at = now
                invite.save(update_fields=["sent_at"])
            challenge = invite.challenge
            body = (
                f"{challenge.host.first_name} invited you to {challenge.title}.\n\n"
                f"Review the rules and rewards before accepting.\n{settings.WEB_ORIGIN}/invite/{invite.id}"
            )
            try:
                send_mail(
                    "You have a GuessWar invitation",
                    body,
                    settings.DEFAULT_FROM_EMAIL,
                    [invite.email],
                )
            except Exception as exc:
                self.stderr.write(
                    f"Invitation delivery failed ({type(exc).__name__}). Queued for retry."
                )
            else:
                Invitation.objects.filter(pk=invite.pk).update(delivered=True)
