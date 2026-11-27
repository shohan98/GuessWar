from datetime import timedelta

import json
import secrets
import time
from functools import wraps

from django.conf import settings
from django.contrib.auth import authenticate, get_user_model, login, logout
from django.contrib.auth.hashers import make_password
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.core.validators import validate_email
from django.db import IntegrityError, transaction
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.shortcuts import get_object_or_404
from django.utils import timezone

from .engine import (
    advance,
    consumed,
    info,
    leaderboard,
    player_view,
    record,
    solved,
    status,
)
from .forms import CreateChallenge, CreateTeam, TeamForm
from .live import live_move, live_state, player_role
from .models import Challenge, Invitation, LiveDuo, Team

User = get_user_model()


def fail(msg, code=400):
    return JsonResponse({"error": msg}, status=code)


def csrf_failure(request, reason=""):
    return fail("Your session changed. Refresh and try again.", 403)


def api(*methods, member=False):
    def decorate(fn):
        @wraps(fn)
        def wrapped(request, *args, **kwargs):
            if request.method not in methods:
                return fail("Unsupported method.", 405)
            if member and not request.user.is_authenticated:
                return fail("Sign in to continue.", 401)
            try:
                request.data = json.loads(request.body or "{}")
                if not isinstance(request.data, dict):
                    return fail("Expected a JSON object.")
            except (ValueError, UnicodeError):
                return fail("Invalid JSON.")
            response = fn(request, *args, **kwargs)
            response["Cache-Control"] = "private, no-store"
            return response

        return wrapped

    return decorate


def session_data(request):
    user = request.user
    return JsonResponse(
        {
            "user": {"name": user.first_name, "email": user.email}
            if user.is_authenticated
            else None,
            "csrf": get_token(request),
        }
    )


session = api("GET")(session_data)


def limited(key, cap, seconds):
    if cache.add(key, 1, seconds):
        return False
    return cache.incr(key) > cap


@api("POST")
def account(request, action):
    data = request.data
    if action == "logout":
        logout(request)
        return session_data(request)
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))
    if action == "verify":
        pending = request.session.get("pending", {})
        if not pending or pending["expires"] < time.time() or pending["attempts"] >= 5:
            return fail("Request a fresh verification code.")
        pending["attempts"] += 1
        request.session["pending"] = pending
        if not secrets.compare_digest(
            pending["code"].encode(), str(data.get("code", "")).encode()
        ):
            return fail("That code did not match.")
        try:
            user = User.objects.create(
                username=pending["email"],
                email=pending["email"],
                first_name=pending["name"],
                password=pending["hash"],
            )
        except IntegrityError:
            return fail("This account already exists. Sign in.")
        request.session.pop("pending", None)
        login(request, user)
        return session_data(request)
    if action not in ("signin", "signup"):
        return fail("Unknown action.", 404)
    if limited(f"auth:{action}:{request.META.get('REMOTE_ADDR')}", 80, 600):
        return fail("Too many attempts. Try again later.", 429)
    if action == "signin":
        if limited("signin:" + email, 25, 600):
            return fail("Too many attempts. Try again later.", 429)
        user = authenticate(request, username=email, password=password)
        if user is None:
            return fail("Check your email and password.", 401)
        login(request, user)
        return session_data(request)
    try:
        validate_email(email)
    except ValidationError:
        return fail("Enter a valid email address.")
    name = str(data.get("name", "")).strip()
    if not 1 <= len(name) <= 60 or not 10 <= len(password) <= 128 or len(email) > 150:
        return fail(
            "Use a display name, an email up to 150 characters and a 10–128 character password."
        )
    if limited("verify-mail:" + email, 5, 600):
        return fail("Please wait before requesting another code.", 429)
    code = f"{secrets.randbelow(1000000):06}"
    try:
        send_mail(
            "Verify your GuessWar email",
            f"Your GuessWar verification code is {code}. It expires in 10 minutes.",
            settings.DEFAULT_FROM_EMAIL,
            [email],
        )
    except Exception:
        return fail("Email delivery is unavailable. Please try again later.", 503)
    request.session["pending"] = {
        "name": name,
        "email": email,
        "hash": make_password(password),
        "code": code,
        "attempts": 0,
        "expires": time.time() + 600,
    }
    return JsonResponse({"verify": True})


def form_error(details):
    key, value = next(iter(details.items()))
    while isinstance(value, (list, dict)):
        if isinstance(value, dict):
            value = next(iter(value.values()))
        else:
            value = next((entry for entry in value if entry), "Check the input.")
    prefix = (
        key.replace("_", " ").capitalize() + ": " if key != "non_field_errors" else ""
    )
    return fail(prefix + str(value))


def team_data(team):
    return {"id": team.pk, "name": team.name, "emails": team.emails}


@api("GET", "POST", member=True)
def teams(request):
    if request.method == "GET":
        records = Team.objects.filter(owner=request.user).order_by("name", "id")
        return JsonResponse({"teams": [team_data(team) for team in records]})
    form = CreateTeam(data=request.data, context={"email": request.user.email})
    if not form.is_valid():
        return form_error(form.errors)
    data = dict(form.validated_data)
    try:
        team, created = Team.objects.get_or_create(
            pk=data.pop("request_id"), owner=request.user, defaults=data
        )
    except IntegrityError:
        return fail("Could not save this team. Reopen the form and try again.", 409)
    return JsonResponse(team_data(team), status=201 if created else 200)


@api("PUT", "DELETE", member=True)
@transaction.atomic
def manage_team(request, pk):
    team = get_object_or_404(
        Team.objects.select_for_update(), pk=pk, owner=request.user
    )
    if request.method == "DELETE":
        team.delete()
        return JsonResponse({"deleted": True})
    form = TeamForm(data=request.data, context={"email": request.user.email})
    if not form.is_valid():
        return form_error(form.errors)
    team.name = form.validated_data["name"]
    team.emails = form.validated_data["emails"]
    team.save(update_fields=["name", "emails"])
    return JsonResponse(team_data(team))


@api("POST", member=True)
def create(request):
    form = CreateChallenge(data=request.data, context={"email": request.user.email})
    if not form.is_valid():
        return form_error(form.errors)
    data = dict(form.validated_data)
    emails = data.pop("emails")
    with transaction.atomic():
        request_id = data.pop("request_id")
        existing = Challenge.objects.filter(
            host=request.user, request_id=request_id
        ).first()
        if existing:
            return JsonResponse({"id": existing.pk})
        if data["mode"] == "team":
            team = (
                Team.objects.select_for_update()
                .filter(pk=data["team_id"], owner=request.user)
                .first()
            )
            if team is None:
                return fail("This team is unavailable. Select another team.")
            if not data["title"]:
                data["title"] = f"{team.name} challenge"
            emails = team.emails
            if len(emails) < 2:
                return fail(
                    "Add at least two members to the team before sending a challenge."
                )
            if len(data["prizes"]) > len(emails):
                return fail("The number of ranked prizes exceeds the team size.")
        data["deadline"] = timezone.now() + timedelta(
            minutes=data.pop("duration_minutes")
        )
        challenge, new = Challenge.objects.get_or_create(
            host=request.user, request_id=request_id, defaults=data
        )
        if new:
            invitations = Invitation.objects.bulk_create(
                [Invitation(challenge=challenge, email=email) for email in emails]
            )
            if challenge.mode == "live":
                LiveDuo.objects.create(
                    invitation=invitations[0],
                    first_player=secrets.choice(["host", "guest"]),
                )
    return JsonResponse({"id": challenge.id}, status=201 if new else 200)


@api("GET", member=True)
def dashboard(request):
    now = timezone.now()
    hosted = [
        info(c)
        for c in Challenge.objects.filter(host=request.user)
        .select_related("host")
        .order_by("-created")
    ]
    inbox = [
        {
            "title": i.challenge.display_title,
            "host": i.challenge.host.first_name,
            "mode": i.challenge.mode,
            "invite": i.id,
            "status": status(i, now),
            "deadline": i.challenge.deadline,
        }
        for i in Invitation.objects.filter(email=request.user.email)
        .select_related("challenge__host")
        .order_by("-challenge__created")
    ]
    return JsonResponse({"hosted": hosted, "inbox": inbox})


@api("GET", member=True)
def host(request, pk):
    challenge = get_object_or_404(
        Challenge.objects.select_related("host"), pk=pk, host=request.user
    )
    with transaction.atomic():
        now = timezone.now()
        if challenge.mode == "live":
            return JsonResponse(
                live_state(
                    challenge.invites.select_related("duo", "challenge__host").get(),
                    "host",
                    now,
                )
            )
        players = []
        for invite in challenge.invites.select_related("challenge"):
            advance(invite, now)
            players.append(
                {
                    "email": invite.email,
                    "status": status(invite, now),
                    "delivered": invite.delivered,
                    "id": invite.id,
                    "solved": solved(invite),
                    "accepted_at": invite.started,
                    "finished_at": invite.finished,
                    "tries_used": consumed(invite),
                }
            )
        return JsonResponse(
            {
                **info(challenge),
                "rounds": challenge.rounds,  # Host-only response.
                "players": players,
                "ranking": leaderboard(challenge, now),
            }
        )


@api("GET")
def invite(request, pk):
    item = get_object_or_404(
        Invitation.objects.select_related("challenge__host", "duo"), pk=pk
    )
    now = timezone.now()
    if item.challenge.mode == "live":
        return JsonResponse(live_state(item, player_role(item, request.user), now))
    own = request.user.is_authenticated and request.user.email == item.email
    with transaction.atomic():
        if own:
            item = (
                Invitation.objects.select_for_update()
                .select_related("challenge__host")
                .get(pk=pk)
            )
            now = timezone.now()
            advance(item, now)
            data = player_view(item, now)
            data["ranking"] = leaderboard(item.challenge, now)
        else:
            data = {
                **info(item.challenge),
                "invite": pk,
                "status": "expired" if item.challenge.deadline <= now else "preview",
            }
        return JsonResponse({**data, "own": own})


@api("POST", member=True)
def move(request, pk, action):
    with transaction.atomic():
        item = get_object_or_404(
            Invitation.objects.select_for_update().select_related("challenge__host"),
            pk=pk,
        )
        now = timezone.now()
        role = player_role(item, request.user)
        if item.challenge.mode == "live" and role:
            return live_move(item, role, action, request.data, now)
        if role != "guest":
            return fail("Invitation not found.", 404)
        advance(item, now)
        state = status(item, now)
        if action in ("accept", "decline") and state == "invited":
            if action == "accept":
                item.started = item.turn_start = now
                item.turns = [[]]
            else:
                item.declined = True
            item.save()
        elif action == "guess" and state == "playing":
            if request.data.get("revision") != consumed(item):
                return JsonResponse(
                    {
                        "error": "Turn changed. Try your next guess.",
                        "state": player_view(item, now),
                    },
                    status=409,
                )
            value = request.data.get("value")
            bounds = item.challenge.rounds[len(item.turns) - 1]
            if type(value) is not int or not bounds["low"] <= value <= bounds["high"]:
                return fail("Enter a whole number inside the range.")
            record(item, value, now)
            item.save(update_fields=["turns", "turn_start", "finished"])
        elif action not in ("accept", "decline", "guess"):
            return fail("Unknown action.", 404)
        return JsonResponse({**player_view(item, now), "own": True})
