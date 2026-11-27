import uuid
from django.conf import settings
from django.db import models


class Team(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    name = models.CharField(max_length=72)
    emails = models.JSONField(default=list)


class Challenge(models.Model):
    team = models.ForeignKey(Team, null=True, blank=True, on_delete=models.SET_NULL)
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    host = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    title = models.CharField(max_length=90)
    mode = models.CharField(max_length=8)
    rounds = models.JSONField()
    tries = models.PositiveIntegerField()
    seconds = models.PositiveIntegerField(default=0)
    deadline = models.DateTimeField()
    win = models.CharField(max_length=220, blank=True)
    lose = models.CharField(max_length=220, blank=True)
    prizes = models.JSONField(default=list)
    created = models.DateTimeField(auto_now_add=True)
    request_id = models.UUIDField()

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["host", "request_id"], name="host_create_once"
            )
        ]


class Invitation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    challenge = models.ForeignKey(
        Challenge, on_delete=models.CASCADE, related_name="invites"
    )
    email = models.EmailField()
    delivered = models.BooleanField(default=False)
    sent_at = models.DateTimeField(null=True)
    started = models.DateTimeField(null=True)
    finished = models.DateTimeField(null=True)
    declined = models.BooleanField(default=False)
    turn_start = models.DateTimeField(null=True)
    # One list of guess records per round. A null guess represents a timeout.
    turns = models.JSONField(default=list)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["challenge", "email"], name="one_invitation_per_player"
            )
        ]
