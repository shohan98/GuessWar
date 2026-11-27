import uuid
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core import mail
from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone

from .models import Challenge, Invitation


class ChallengeFlowTests(TestCase):
    def setUp(self):
        user = get_user_model()
        self.host = user.objects.create_user(
            "host@example.com", "host@example.com", first_name="Host"
        )
        self.player = user.objects.create_user(
            "player@example.com", "player@example.com", first_name="Player"
        )
        self.payload = dict(
            request_id=str(uuid.uuid4()),
            title="Coffee Duel",
            mode="duel",
            emails=[self.player.email],
            low=1,
            high=100,
            numbers=[22, 33],
            tries=3,
            seconds=10,
            duration_minutes=60,
            win="Host buys coffee",
            lose="Player buys coffee",
        )
        self.client.force_login(self.host)

    def post(self, url, data=None):
        return self.client.post(url, data or {}, content_type="application/json")

    def create(self):
        self.assertEqual(self.post("/api/challenges", self.payload).status_code, 201)
        self.invite = Invitation.objects.get(email=self.player.email)
        self.url = "/api/invites/" + str(self.invite.pk)

    def test_identity_retries_and_multiple_rounds(self):
        self.create()
        self.assertEqual(self.post("/api/challenges", self.payload).status_code, 200)
        self.assertEqual(Invitation.objects.count(), 1)
        self.assertNotContains(self.client.get(self.url), '"target"')
        self.assertEqual(self.post(self.url + "/accept").status_code, 404)
        self.client.force_login(self.player)
        self.assertEqual(self.post(self.url + "/accept").json()["status"], "playing")
        first = {"revision": 0, "value": 22}
        self.assertEqual(self.post(self.url + "/guess", first).json()["solved"], 1)
        self.assertEqual(self.post(self.url + "/guess", first).status_code, 409)
        self.assertEqual(
            self.post(self.url + "/guess", {"revision": 1, "value": 33}).json()[
                "status"
            ],
            "finished",
        )
        self.assertEqual(self.client.get(self.url).json()["solved"], 2)

    def test_refresh_consumes_elapsed_turns(self):
        self.create()
        self.client.force_login(self.player)
        self.post(self.url + "/accept")
        then = timezone.now() - timedelta(seconds=41)
        Invitation.objects.update(started=then, turn_start=then)
        state = self.client.get(self.url).json()
        self.assertEqual(state["revision"], 4)
        self.assertEqual(len(state["turns"]), 2)
        self.assertEqual(state["turns"][1][0]["hint"], "timeout")

    def test_team_delivery_deadline_and_rank(self):
        self.payload.update(
            mode="team",
            emails=[self.player.email, "other@example.com"],
            prizes=["Coffee"],
        )
        self.create()
        call_command("send_invites")
        call_command("send_invites")
        self.assertEqual(len(mail.outbox), 2)
        self.client.force_login(self.player)
        self.post(self.url + "/accept")
        self.post(self.url + "/guess", {"revision": 0, "value": 22})
        self.post(self.url + "/guess", {"revision": 1, "value": 33})
        self.assertIsNone(self.client.get(self.url).json()["ranking"])
        Challenge.objects.update(deadline=timezone.now())
        row = self.client.get(self.url).json()["ranking"][0]
        self.assertEqual((row["rank"], row["gift"], row["solved"]), (1, "Coffee", 2))
        self.client.force_login(self.host)
        self.assertEqual(
            self.client.get("/api/challenges/" + str(self.invite.challenge_id)).json()[
                "players"
            ][1]["status"],
            "expired",
        )

    def test_deadline_excludes_unfinished_run(self):
        self.payload.update(seconds=0)
        self.create()
        self.client.force_login(self.player)
        self.post(self.url + "/accept")
        Challenge.objects.update(deadline=timezone.now() - timedelta(seconds=1))
        self.assertEqual(
            self.post(self.url + "/guess", {"revision": 0, "value": 22}).json()[
                "status"
            ],
            "expired",
        )

    def test_preset_duration_starts_at_send_and_retries_keep_deadline(self):
        for minutes in (10, 60, 1440):
            with self.subTest(minutes=minutes):
                self.payload.update(
                    request_id=str(uuid.uuid4()), duration_minutes=minutes, tries=21
                )
                before = timezone.now()
                response = self.post("/api/challenges", self.payload)
                self.assertEqual(response.status_code, 201)
                challenge = Challenge.objects.get(id=response.json()["id"])
                self.assertGreaterEqual(
                    challenge.deadline, before + timedelta(minutes=minutes)
                )
                self.assertLessEqual(
                    challenge.deadline, timezone.now() + timedelta(minutes=minutes)
                )
                deadline = challenge.deadline
                self.assertEqual(
                    self.post("/api/challenges", self.payload).status_code, 200
                )
                challenge.refresh_from_db()
                self.assertEqual(challenge.deadline, deadline)
                self.assertEqual(
                    [(r["low"], r["high"]) for r in challenge.rounds], [(1, 100)] * 2
                )

    def test_invalid_rules_and_default_choices(self):
        for invalid in (
            {"tries": 4},
            {"seconds": 17},
            {"duration_minutes": 12},
            {"low": 100},
            {"high": 1_000_001},
            {"numbers": [22, 101]},
        ):
            with self.subTest(invalid=invalid):
                self.assertEqual(
                    self.post("/api/challenges", self.payload | invalid).status_code,
                    400,
                )
        for field in ("tries", "seconds", "title", "duration_minutes"):
            self.payload.pop(field)
        self.create()
        c = self.invite.challenge
        self.assertEqual(
            (c.tries, c.seconds, c.title), (7, 10, "Head-to-head challenge")
        )

    def test_one_million_is_a_playable_secret(self):
        self.payload.update(low=999_999, high=1_000_000, numbers=[1_000_000])
        self.create()
        self.client.force_login(self.player)
        self.post(self.url + "/accept")
        state = self.post(
            self.url + "/guess", {"revision": 0, "value": 1_000_000}
        ).json()
        self.assertEqual((state["status"], state["solved"]), ("finished", 1))

    def test_host_secrets_and_invitation_responses(self):
        self.payload.update(
            mode="team",
            emails=[self.player.email, "other@example.com"],
            prizes=["Coffee"],
        )
        self.create()
        host_url = "/api/challenges/" + str(self.invite.challenge_id)
        self.assertEqual(
            [r["target"] for r in self.client.get(host_url).json()["rounds"]], [22, 33]
        )
        other = Invitation.objects.exclude(pk=self.invite.pk).get()
        other.declined = True
        other.save()
        self.client.force_login(self.player)
        self.assertEqual(self.client.get(host_url).status_code, 404)
        self.assertNotContains(self.client.get(self.url), '"target"')
        self.post(self.url + "/accept")
        self.assertNotContains(self.client.get(self.url), '"target"')
        self.post(self.url + "/guess", {"revision": 0, "value": 22})
        self.client.force_login(self.host)
        rows = {p["email"]: p for p in self.client.get(host_url).json()["players"]}
        player = rows[self.player.email]
        self.assertEqual(
            (player["status"], player["solved"], player["tries_used"]),
            ("playing", 1, 1),
        )
        self.assertIsNotNone(player["accepted_at"])
        self.assertEqual(rows[other.email]["status"], "declined")
