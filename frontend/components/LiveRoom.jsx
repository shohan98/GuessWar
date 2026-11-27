"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Copy, LockKeyhole, Swords, Trophy } from "lucide-react";
import { api, date, ErrorLine, PanelTitle, Stakes } from "./ui";
import { GuessHistory } from "./Arena";

const fmt = new Intl.NumberFormat("en-US").format;

export default function LiveRoom({ initial, user }) {
  const [match, setMatch] = useState(initial);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [syncError, setSyncError] = useState("");
  const [copied, setCopied] = useState("");
  const path = "invites/" + match.invite;
  const { status, role, moves = [], winner } = match;
  const { low, high } = match.rounds[0];
  const active = status === "invited" || status === "playing";
  const myTurn = status === "playing" && match.turn === role;
  const chooseSecret = status === "invited" && role === "guest";
  const reviewing = status === "preview" || chooseSecret;
  const last = moves.at(-1);
  const merge = useCallback((next) => {
    setMatch((prev) => (next.server_time >= prev.server_time ? next : prev));
  }, []);
  useEffect(() => {
    if (!role || !active) return;
    let stopped = false,
      pending = false;
    async function sync() {
      if (pending || document.hidden) return;
      pending = true;
      try {
        const state = await api(path);
        if (!stopped) {
          merge(state);
          setSyncError("");
        }
      } catch {
        if (!stopped) setSyncError("Reconnecting to the match…");
      } finally {
        pending = false;
      }
    }
    const timer = setInterval(sync, 2000);
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("focus", sync);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("focus", sync);
    };
  }, [active, role, path, merge]);

  async function act(action) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const next = await api(path + "/" + action, {
        value: Number(value),
        revision: match.revision,
      });
      merge(next);
      setValue("");
      setSyncError("");
    } catch (e) {
      if (e.data?.state) merge(e.data.state);
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const target = encodeURIComponent("/invite/" + match.invite);
  const valid =
    /^-?\d+$/.test(value) && Number(value) >= low && Number(value) <= high;
  let title = "Live Duo invitation";
  if (status === "closed") title = "Match closed";
  if (status === "expired") title = "Match expired";
  if (status === "declined") title = "Invitation declined";
  if (chooseSecret) title = "Lock your number";
  if (status === "invited" && role === "host")
    title = "Waiting for your opponent";
  if (status === "playing") title = myTurn ? "Your turn" : "Opponent’s turn";
  if (status === "finished")
    title = winner === role ? "You won!" : "Your opponent won";
  return (
    <div className="duo-room">
      <PanelTitle label="LIVE DUO · HEAD-TO-HEAD" title={match.title}>
        <p>
          Hosted by {match.host} · Closes {date(match.deadline)}
        </p>
      </PanelTitle>
      <div className={reviewing ? "duo-invitation" : "formgrid"}>
        <section
          className={
            "panel duo-board " +
            (status === "finished" && winner === role ? "duo-win" : "")
          }
        >
          {status === "finished" && winner === role ? (
            <Trophy className="duo-icon" />
          ) : (
            <Swords className="duo-icon" />
          )}
          <h2 aria-live="polite">{title}</h2>
          {reviewing && (
            <>
              <p>
                Each player locks a number from{" "}
                <b>
                  {fmt(low)} to {fmt(high)}
                </b>
                . The game picks who goes first. Take turns guessing your
                opponent’s number. First correct guess wins.
              </p>
              <Stakes c={match} />
            </>
          )}
          {status === "preview" &&
            (!user ? (
              <div className="actions">
                <Link className="btn primary" href={"/signin?next=" + target}>
                  Sign in to play
                </Link>
                <Link className="textlink" href={"/signup?next=" + target}>
                  Create an account
                </Link>
              </div>
            ) : (
              <p>Use the invited email address to join.</p>
            ))}
          {status === "invited" && role === "host" && (
            <>
              <p>
                Your number is locked. Play starts when{" "}
                <b>{match.opponent_email}</b> accepts and locks theirs.
              </p>
              <button
                className="btn"
                onClick={async () => {
                  const url = location.origin + "/invite/" + match.invite;
                  try {
                    await navigator.clipboard.writeText(url);
                    setCopied("Invitation link copied.");
                  } catch {
                    setCopied(url);
                  }
                }}
              >
                <Copy size={15} /> Copy invitation
              </button>
              <small role="status">{copied}</small>
            </>
          )}
          {status === "playing" && (
            <p>
              Guess {role === "host" ? "your guest’s" : "your host’s"} number
              between{" "}
              <b>
                {fmt(low)} and {fmt(high)}
              </b>
              .
            </p>
          )}
          {last && (
            <div className={"guessfeedback " + last.hint} role="status">
              <div>
                <strong>
                  {last.hint === "correct"
                    ? "Correct!"
                    : last.hint === "high"
                      ? "Too high ↓"
                      : "Too low ↑"}
                </strong>
                <span>
                  {last.player === role
                    ? "You guessed"
                    : "Your opponent guessed"}{" "}
                  {fmt(last.value)}
                </span>
              </div>
            </div>
          )}
          {(chooseSecret || myTurn) && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (valid) act(chooseSecret ? "accept" : "guess");
              }}
            >
              <label>
                {chooseSecret ? "Your secret number" : "Your guess"}
                <input
                  key={chooseSecret ? "secret" : "guess"}
                  type="number"
                  step="1"
                  min={low}
                  max={high}
                  required
                  value={value}
                  autoComplete="off"
                  onChange={(e) => setValue(e.target.value)}
                />
              </label>
              <div className="actions">
                <button className="btn primary" disabled={busy || !valid}>
                  {chooseSecret ? "Accept & lock number" : "Guess"}{" "}
                  <ArrowRight size={16} />
                </button>
                {chooseSecret && (
                  <button
                    type="button"
                    className="textlink"
                    disabled={busy}
                    onClick={() => act("decline")}
                  >
                    Decline invitation
                  </button>
                )}
              </div>
            </form>
          )}
          {status === "finished" && (
            <div className="pledge">
              <small>
                Agreed commitment ·{" "}
                {winner === role ? "Your opponent will" : "You will"}
              </small>
              <strong>{winner === "guest" ? match.win : match.lose}</strong>
            </div>
          )}
          {status === "expired" && (
            <p>The deadline passed before anyone solved the match.</p>
          )}
          {["expired", "declined", "finished"].includes(status) && role && (
            <Link href="/create?mode=live" className="textlink">
              Start another Live Duo <ArrowRight size={15} />
            </Link>
          )}
          <ErrorLine text={error || syncError} />
        </section>
        {!reviewing && (
          <aside className="duo-side">
            {role && (status === "playing" || moves.length > 0) && (
              <GuessHistory turns={[moves]} viewer={role} />
            )}
            <section className="panel">
              <h2>The stakes</h2>
              <Stakes c={match} />
              {match.own_secret != null && (
                <details className="hostsecrets">
                  <summary>
                    <LockKeyhole size={15} /> Your locked number
                  </summary>
                  <p>{fmt(match.own_secret)}</p>
                </details>
              )}
            </section>
          </aside>
        )}
      </div>
    </div>
  );
}
