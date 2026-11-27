from django.http import JsonResponse

from .engine import info, status


def player_role(invite, user):
    if user.is_authenticated:
        if user.pk == invite.challenge.host_id:
            return "host"
        if user.email == invite.email:
            return "guest"
    return None


def other(role):
    return "guest" if role == "host" else "host"


def live_state(invite, role, now):
    challenge = invite.challenge
    state = status(invite, now)
    public_status = "closed" if state in ("declined", "finished") else "preview"
    data = {
        **info(challenge),
        "invite": str(invite.pk),
        "role": role,
        "server_time": now,
        "status": state if role or state == "expired" else public_status,
    }
    if role:
        duo = invite.duo
        data.update(
            own_secret=challenge.rounds[0]["target"]
            if role == "host"
            else duo.guest_secret,
            moves=duo.moves,
            revision=len(duo.moves),
            turn=(other(duo.moves[-1]["player"]) if duo.moves else duo.first_player)
            if state == "playing"
            else None,
            winner=duo.moves[-1]["player"] if state == "finished" else None,
        )
        if role == "host":
            data["opponent_email"] = invite.email
    return data


def live_move(invite, role, action, payload, now):
    current = live_state(invite, role, now)
    state = current["status"]
    duo = invite.duo

    def conflict(message):
        return JsonResponse({"error": message, "state": current}, status=409)

    if action in ("accept", "decline"):
        if role != "guest" or state != "invited":
            return conflict("This invitation can no longer be answered.")
        if action == "decline":
            invite.declined = True
            invite.save(update_fields=["declined"])
            return JsonResponse(live_state(invite, role, now))
    elif action == "guess":
        if state != "playing" or current["turn"] != role:
            return conflict("It is not your turn.")
        if (
            type(payload.get("revision")) is not int
            or payload["revision"] != current["revision"]
        ):
            return conflict("The match has moved on. Check the latest turn.")
    else:
        return JsonResponse({"error": "Unknown action."}, status=404)

    value = payload.get("value")
    bounds = invite.challenge.rounds[0]
    if type(value) is not int or not bounds["low"] <= value <= bounds["high"]:
        return JsonResponse(
            {"error": "Enter a whole number inside the range."}, status=400
        )
    if action == "accept":
        duo.guest_secret = value
        duo.save(update_fields=["guest_secret"])
        invite.started = now
        invite.save(update_fields=["started"])
    else:
        target = duo.guest_secret if role == "host" else bounds["target"]
        hint = "high" if value > target else "low" if value < target else "correct"
        duo.moves.append({"player": role, "value": value, "hint": hint})
        duo.save(update_fields=["moves"])
        if hint == "correct":
            invite.finished = now
            invite.save(update_fields=["finished"])
    return JsonResponse(live_state(invite, role, now))
