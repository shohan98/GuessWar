"use client";
import Link from "next/link";
import {
  ArrowUpRight,
  Fingerprint,
  Hash,
  UsersRound,
  Swords,
  Timer,
  Layers,
  Crosshair,
} from "lucide-react";

export async function api(
  path,
  body,
  method = body === undefined ? "GET" : "POST",
) {
  const token = document.cookie
    .split("; ")
    .find((v) => v.startsWith("csrftoken="))
    ?.slice(10);
  const response = await fetch("/api/" + path, {
    method,
    cache: "no-store",
    headers: { "Content-Type": "application/json", "X-CSRFToken": token || "" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw Object.assign(
      new Error(
        data.error ||
          (response.status === 404
            ? "This challenge could not be found."
            : "Something went wrong. Try again."),
      ),
      { data },
    );
  return data;
}
export function Brand() {
  return (
    <Link className="brand" href="/" aria-label="GuessWar home">
      <span className="brandmark">
        <i />
        <i />
        <i />
      </span>
      Guess<span>War</span>
    </Link>
  );
}
export function Ticket({ team = false, compact = false }) {
  return (
    <div className={"art " + (compact ? "compact" : "")} aria-hidden="true">
      <div className="scanline" />
      <div className="pass backpass">
        <div className="backstripes" />
      </div>
      <div className="pass frontpass">
        <div className="passhead">
          <span>
            <Fingerprint size={16} /> GUESSWAR
          </span>
          <span>{team ? "TEAM" : "DUEL"} PASS</span>
        </div>
        <div className="passface">
          <div className="digits">?</div>
          <div className="range">
            <span>MIN</span>001
            <i />
            <span>MAX</span>100
          </div>
        </div>
        <div className="passfoot">
          <span className="barcode" />
          <strong>SECRET NUMBER</strong>
          <Hash size={16} />
        </div>
      </div>
    </div>
  );
}
export function Home({ user }) {
  return (
    <>
      <section className="hero">
        <div className="herocopy">
          <div className="eyebrow">
            <i /> BROWSER ARCADE
          </div>
          <h1>
            Pick a number.
            <br />
            <em>Set the stakes.</em>
          </h1>
          <p>
            Hide a number, make a promise, and challenge someone to guess it.
            Every round starts with an invite.
          </p>
          <div className="actions">
            <Link
              className="btn primary"
              href={user ? "/create" : "/signup?next=/create"}
            >
              Create a challenge <ArrowUpRight size={18} />
            </Link>
            <Link className="textlink" href="/practice">
              Try a round <span>→</span>
            </Link>
          </div>
        </div>
        <Ticket />
      </section>
      <section className="modes">
        <header className="sectiontitle">
          <h2>Choose your matchup</h2>
          <span className="rule" />
        </header>
        <div className="modegrid">
          {[
            [
              "duel",
              Swords,
              "Head-to-head",
              "One rival. Two promises. Agree on what happens if either side wins.",
            ],
            [
              "team",
              UsersRound,
              "Team challenge",
              "Invite the whole crew to guess the same numbers and compete for ranked prizes.",
            ],
          ].map(([mode, Icon, title, desc]) => (
            <Link
              className={"mode " + mode}
              key={mode}
              href={
                user
                  ? "/create?mode=" + mode
                  : "/signup?next=" + encodeURIComponent("/create?mode=" + mode)
              }
            >
              <span className="modeicon">
                <Icon size={25} />
              </span>
              <div>
                <h3>{title}</h3>
                <p>{desc}</p>
              </div>
              <ArrowUpRight size={17} />
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
export function Rules({ c }) {
  return (
    <div className="rules">
      {[
        [Layers, c.rounds.length, "rounds"],
        [Crosshair, c.tries, "tries / round"],
        [Timer, c.seconds ? c.seconds + "s" : "Off", "guess timer"],
      ].map(([Icon, n, t]) => (
        <div key={t}>
          <Icon size={17} />
          <strong>{n}</strong>
          <small>{t}</small>
        </div>
      ))}
    </div>
  );
}
export function Stakes({ c }) {
  return (
    <div className="terms">
      {c.mode === "team" ? (
        c.prizes.map((p, i) => (
          <div key={i}>
            <small>Rank {i + 1} prize</small>
            <b>{p}</b>
          </div>
        ))
      ) : (
        <>
          <div>
            <small>If the invitee solves every round</small>
            <b>{c.win}</b>
          </div>
          <div>
            <small>If the invitee falls short</small>
            <b>{c.lose}</b>
          </div>
        </>
      )}
    </div>
  );
}
export function Ranking({ rows }) {
  if (!rows)
    return (
      <p className="muted">Final rankings appear when the challenge closes.</p>
    );
  return rows.length ? (
    <ol className="ranklist">
      {rows.map((r, i) => (
        <li key={i}>
          <strong>#{r.rank}</strong>
          <div>
            <b>{r.name}</b>
            <small>
              {r.solved} solved · {r.tries} attempts ·{" "}
              {(r.ms / 1000).toFixed(1)}s
            </small>
          </div>
          <span>{r.gift}</span>
        </li>
      ))}
    </ol>
  ) : (
    <p className="muted">No completed runs.</p>
  );
}
export function PanelTitle({ label, title, children }) {
  return (
    <div className="pagetitle">
      <div className="eyebrow">
        <i />
        {label}
      </div>
      <h1>{title}</h1>
      {children}
    </div>
  );
}
export function ErrorLine({ text }) {
  return text ? (
    <p className="error" role="alert">
      {text}
    </p>
  ) : null;
}
export function date(value) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
