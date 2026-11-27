from datetime import timedelta
from django.contrib.auth import get_user_model


def consumed(invite):
    return sum(map(len, invite.turns))


def solved(invite):
    return sum(bool(row and row[-1]["hint"] == "correct") for row in invite.turns)


def record(invite, value, at):
    challenge = invite.challenge
    index = len(invite.turns) - 1
    target = challenge.rounds[index]["target"]
    hint = (
        "timeout"
        if value is None
        else "high"
        if value > target
        else "low"
        if value < target
        else "correct"
    )
    current = invite.turns[index]
    current.append({"value": value, "hint": hint})
    invite.turn_start = at
    if hint == "correct" or len(current) == challenge.tries:
        if index + 1 == len(challenge.rounds):
            invite.finished = at
        else:
            invite.turns.append([])


def advance(invite, now):
    if not invite.started or invite.finished:
        return
    seconds = invite.challenge.seconds
    limit = min(now, invite.challenge.deadline)
    changed = False
    while (
        seconds
        and not invite.finished
        and invite.turn_start + timedelta(seconds=seconds) <= limit
    ):
        record(invite, None, invite.turn_start + timedelta(seconds=seconds))
        changed = True
    if changed:
        invite.save(update_fields=["turns", "turn_start", "finished"])


def status(invite, now):
    if invite.finished:
        return "finished"
    if invite.declined:
        return "declined"
    if now >= invite.challenge.deadline:
        return "expired"
    return "playing" if invite.started else "invited"


def info(challenge):
    return {
        "id": str(challenge.pk),
        "title": challenge.title,
        "mode": challenge.mode,
        "host": challenge.host.first_name,
        "rounds": [{"low": r["low"], "high": r["high"]} for r in challenge.rounds],
        "tries": challenge.tries,
        "seconds": challenge.seconds,
        "deadline": challenge.deadline,
        "win": challenge.win,
        "lose": challenge.lose,
        "prizes": challenge.prizes,
    }


def player_view(invite, now):
    expires = invite.challenge.deadline
    if invite.started and invite.challenge.seconds:
        expires = min(
            expires, invite.turn_start + timedelta(seconds=invite.challenge.seconds)
        )
    return {
        **info(invite.challenge),
        "invite": str(invite.pk),
        "status": status(invite, now),
        "turns": invite.turns,
        "revision": consumed(invite),
        "solved": solved(invite),
        "clock": expires,
        "server_time": now,
    }


def leaderboard(challenge, now):
    if now < challenge.deadline:
        return None
    results = []
    for invite in challenge.invites.select_related("challenge"):
        advance(invite, now)
        if invite.finished:
            results.append(
                (
                    solved(invite),
                    consumed(invite),
                    int((invite.finished - invite.started).total_seconds() * 1000),
                    invite.email,
                )
            )
    names = dict(
        get_user_model()
        .objects.filter(username__in=[r[3] for r in results])
        .values_list("username", "first_name")
    )
    results.sort(key=lambda r: (-r[0], r[1], r[2]))
    rows = []
    for index, row in enumerate(results):
        rank = (
            rows[-1]["rank"]
            if index and row[:3] == results[index - 1][:3]
            else index + 1
        )
        rows.append(
            {
                "rank": rank,
                "name": names.get(row[3], "Player"),
                "solved": row[0],
                "tries": row[1],
                "ms": row[2],
                "gift": challenge.prizes[rank - 1]
                if rank <= len(challenge.prizes)
                else "",
            }
        )
    return rows
