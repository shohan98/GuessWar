import uuid

from rest_framework import serializers as s


class TeamForm(s.Serializer):
    name = s.CharField(max_length=72)
    emails = s.ListField(child=s.EmailField(max_length=254), max_length=50)

    def validate_emails(self, values):
        emails = [email.lower() for email in values]
        if len(emails) != len(set(emails)):
            raise s.ValidationError("Enter each member once.")
        if self.context["email"] in emails:
            raise s.ValidationError(
                "Leave your own email out of the roster. You host the challenge."
            )
        return emails


class CreateTeam(TeamForm):
    request_id = s.UUIDField(default=uuid.uuid4)


class CreateChallenge(s.Serializer):
    request_id = s.UUIDField()
    title = s.CharField(max_length=90, required=False, allow_blank=True, default="")
    mode = s.ChoiceField(choices=["duel", "team", "live"])
    team_id = s.UUIDField(required=False)
    emails = s.ListField(
        child=s.EmailField(max_length=254),
        min_length=1,
        max_length=50,
        required=False,
        default=list,
    )
    low = s.IntegerField(min_value=-999999, max_value=1_000_000)
    high = s.IntegerField(min_value=-999999, max_value=1_000_000)
    numbers = s.ListField(child=s.IntegerField(), min_length=1, max_length=10)
    tries = s.ChoiceField(choices=[3, 7, 13, 21], default=7)
    seconds = s.ChoiceField(choices=[0, 5, 10, 15, 30, 60, 120], default=10)
    duration_minutes = s.ChoiceField(choices=[10, 60, 1440], default=60)
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
        low, high = data.pop("low"), data.pop("high")
        numbers = data.pop("numbers")
        if low >= high or any(not low <= n <= high for n in numbers):
            raise s.ValidationError(
                "Choose a valid shared range and keep every secret inside it."
            )
        data["rounds"] = [
            {"low": low, "high": high, "target": number} for number in numbers
        ]
        if data["mode"] == "live":
            if len(numbers) != 1:
                raise s.ValidationError("Live Duo needs one secret number per player.")
            data["tries"] = data["seconds"] = 0
        if not data["title"] and data["mode"] != "team":
            data["title"] = "Live Duo" if data["mode"] == "live" else "Single Challenge"
        if data["mode"] != "team" and (
            "team_id" in data or len(emails) != 1 or not data["win"] or not data["lose"]
        ):
            raise s.ValidationError("Invite one opponent and enter both commitments.")
        if data["mode"] == "team" and (
            emails or "team_id" not in data or not data["prizes"]
        ):
            raise s.ValidationError(
                "Select a saved team and add at least one ranked prize."
            )
        data["emails"] = emails
        return data
