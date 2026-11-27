from django.utils import timezone
from rest_framework import serializers as s


class Round(s.Serializer):
    low = s.IntegerField(min_value=-999999, max_value=999999)
    high = s.IntegerField(min_value=-999999, max_value=999999)
    target = s.IntegerField()

    def validate(self, data):
        if (
            data["low"] >= data["high"]
            or not data["low"] <= data["target"] <= data["high"]
        ):
            raise s.ValidationError(
                "Choose two distinct bounds and a secret number inside them."
            )
        return data


class CreateChallenge(s.Serializer):
    request_id = s.UUIDField()
    title = s.CharField(max_length=90)
    mode = s.ChoiceField(choices=["duel", "team"])
    emails = s.ListField(
        child=s.EmailField(max_length=254), min_length=1, max_length=50
    )
    rounds = Round(many=True, min_length=1, max_length=10)
    tries = s.IntegerField(min_value=1, max_value=20)
    seconds = s.IntegerField(min_value=0, max_value=120)
    deadline = s.DateTimeField()
    win = s.CharField(max_length=220, required=False, allow_blank=True, default="")
    lose = s.CharField(max_length=220, required=False, allow_blank=True, default="")
    prizes = s.ListField(
        child=s.CharField(max_length=220), max_length=10, required=False, default=list
    )

    def validate(self, data):
        emails = [email.lower() for email in data["emails"]]
        if len(set(emails)) != len(emails) or self.context["email"] in emails:
            raise s.ValidationError(
                "Invite each opponent once and leave out your own email."
            )
        if data["deadline"] <= timezone.now():
            raise s.ValidationError("Choose a future deadline.")
        if data["mode"] == "duel" and (
            len(emails) != 1 or not data["win"] or not data["lose"]
        ):
            raise s.ValidationError("A duel needs one opponent and both commitments.")
        if data["mode"] == "team" and (
            len(emails) < 2 or not 1 <= len(data["prizes"]) <= len(emails)
        ):
            raise s.ValidationError(
                "Invite at least two people and add a prize for each rewarded rank."
            )
        data["emails"] = emails
        return data
