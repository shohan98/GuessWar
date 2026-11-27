from rest_framework import serializers as s


class CreateChallenge(s.Serializer):
    request_id = s.UUIDField()
    title = s.CharField(max_length=90, required=False, allow_blank=True, default="")
    mode = s.ChoiceField(choices=["duel", "team"])
    emails = s.ListField(
        child=s.EmailField(max_length=254), min_length=1, max_length=50
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
        if not data["title"]:
            data["title"] = (
                "Head-to-head challenge" if data["mode"] == "duel" else "Team challenge"
            )
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
