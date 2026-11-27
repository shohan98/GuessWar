"use client";
import { useEffect, useState, useRef } from "react";
import {
  Delete,
  Volume2,
  VolumeX,
  Timer,
  ArrowDown,
  ArrowUp,
  Check,
  History,
  Clock3,
  Crosshair,
} from "lucide-react";
import { ErrorLine } from "./ui";
const words = {
  high: "Too high. Bring it down!",
  low: "Too low. Aim higher!",
  correct: "Right on the number!",
  timeout: "Time slipped away.",
};
const hints = {
  high: { label: "Too high", icon: ArrowDown },
  low: { label: "Too low", icon: ArrowUp },
  correct: { label: "Correct", icon: Check },
  timeout: { label: "Time up", icon: Clock3 },
};
const formatNumber = new Intl.NumberFormat("en-US").format;

export function GuessHistory({ turns, viewer }) {
  const list = useRef(null);
  const entries = turns
    .flatMap((guesses, round) =>
      guesses.map((guess, attempt) => ({
        ...guess,
        round: round + 1,
        attempt: attempt + 1,
      })),
    )
    .reverse();
  useEffect(() => {
    if (list.current) {
      list.current.scrollTop = 0;
      list.current.scrollLeft = 0;
    }
  }, [entries.length]);
  return (
    <aside className="guesshistory" aria-label="Guess history">
      <h3>
        <History size={17} aria-hidden="true" />
        Guess history
      </h3>
      {entries.length ? (
        <ol ref={list} aria-label="Newest guess first">
          {entries.map((entry) => {
            const { label, icon: Icon } = hints[entry.hint];
            return (
              <li key={entry.round + "-" + entry.attempt}>
                <small
                  aria-label={
                    viewer
                      ? (entry.player === viewer
                          ? "Your guess "
                          : "Opponent guess ") + entry.attempt
                      : "Round " + entry.round + ", attempt " + entry.attempt
                  }
                >
                  {viewer
                    ? entry.player === viewer
                      ? "You · "
                      : "Them · "
                    : turns.length > 1
                      ? "R" + entry.round + " · "
                      : ""}
                  #{entry.attempt}
                </small>
                <b>{entry.value === null ? "—" : formatNumber(entry.value)}</b>
                <span className={"guesshint " + entry.hint}>
                  <Icon size={14} aria-hidden="true" />
                  {label}
                </span>
              </li>
            );
          })}
        </ol>
      ) : (
        <p>No guesses yet</p>
      )}
    </aside>
  );
}

function Feedback({ guesses, round, previous }) {
  const last = guesses.at(-1);
  let title = "Make a guess",
    detail = "Enter a number in the range.",
    tone = "ready",
    Icon = Crosshair;
  if (last) {
    const hint = hints[last.hint];
    title = hint.label;
    Icon = hint.icon;
    tone = last.hint;
    detail =
      last.value === null
        ? "That attempt used one try."
        : "You guessed " + formatNumber(last.value);
  } else if (round > 0) {
    const solved = previous.at(-1)?.hint === "correct";
    title = solved ? "Round solved" : "Round finished";
    detail = "Round " + (round + 1) + " is ready.";
    tone = solved ? "correct" : "ready";
    Icon = solved ? Check : Crosshair;
  }
  return (
    <div
      className={"guessfeedback " + tone}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <Icon size={30} aria-hidden="true" strokeWidth={2.5} />
      <div>
        <strong>{title}</strong>
        <span>{detail}</span>
      </div>
      {last && (
        <span className="sr">
          Round {round + 1}, attempt {guesses.length}.
        </span>
      )}
    </div>
  );
}

export default function Arena({ c, onGuess, onTimeout, busy, error }) {
  const [value, setValue] = useState(""),
    [remaining, setRemaining] = useState(0),
    [sound, setSound] = useState(false);
  const round = c.turns.length - 1,
    guesses = c.turns[round],
    last = guesses.at(-1) || c.turns[round - 1]?.at(-1);
  const { low, high } = c.rounds[round],
    ref = useRef(null);
  useEffect(() => {
    setValue("");
    ref.current?.focus({ preventScroll: true });
  }, [c.revision]);
  useEffect(() => {
    if (sound && last && window.speechSynthesis) {
      speechSynthesis.cancel();
      speechSynthesis.speak(new SpeechSynthesisUtterance(words[last.hint]));
    }
    return () => window.speechSynthesis?.cancel();
  }, [c.revision, sound, last?.hint]);
  useEffect(() => {
    const until =
      performance.now() +
      new Date(c.clock).getTime() -
      new Date(c.server_time).getTime();
    function tick() {
      const n = Math.max(0, Math.ceil((until - performance.now()) / 1000));
      setRemaining(n);
      return n;
    }
    tick();
    const interval = setInterval(() => {
      if (!tick()) {
        clearInterval(interval);
        onTimeout();
      }
    }, 180);
    return () => clearInterval(interval);
  }, [c.clock, c.server_time, onTimeout]);
  const valid =
    /^-?\d+$/.test(value) && Number(value) >= low && Number(value) <= high;
  return (
    <section className="playpanel">
      <header>
        <div>
          <small>
            {c.mode === "practice"
              ? "PRACTICE"
              : c.mode === "duel"
                ? "SINGLE CHALLENGE"
                : "TEAM CHALLENGE"}
          </small>
          <h2>{c.title}</h2>
        </div>
        <button
          className="iconbtn"
          aria-label={sound ? "Mute voice" : "Enable voice reactions"}
          aria-pressed={sound}
          onClick={() => setSound(!sound)}
        >
          {sound ? <Volume2 /> : <VolumeX />}
        </button>
      </header>
      <div className="playstats">
        <span>
          Round{" "}
          <b>
            {round + 1}/{c.rounds.length}
          </b>
        </span>
        <span>
          Tries left <b>{c.tries - guesses.length}</b>
        </span>
        <span>
          <Timer size={14} />
          {c.seconds ? remaining + "s" : "Untimed"}
        </span>
      </div>
      <div className="arenalayout">
        <form
          className="console"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid && !busy) onGuess(Number(value));
          }}
        >
          <span className="eyebrow">GUESS THE NUMBER</span>
          <h1>
            {low} <em>—</em> {high}
          </h1>
          <label className="numberbox">
            <span className="sr">Your guess</span>
            <input
              ref={ref}
              autoComplete="off"
              inputMode={low < 0 ? "text" : "numeric"}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              maxLength={8}
              placeholder="?"
            />
          </label>
          <Feedback
            guesses={guesses}
            round={round}
            previous={c.turns[round - 1]}
          />
          <div className="keypad">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setValue((v) => (v + n).slice(0, 8))}
              >
                {n}
              </button>
            ))}
            <button
              aria-label="Delete digit"
              type="button"
              onClick={() => setValue((v) => v.slice(0, -1))}
            >
              <Delete size={17} />
            </button>
            <button
              type="button"
              onClick={() => setValue((v) => (v + "0").slice(0, 8))}
            >
              0
            </button>
            <button className="submitkey" disabled={!valid || busy}>
              Guess
            </button>
          </div>
          {low < 0 && (
            <button
              className="add"
              type="button"
              onClick={() =>
                setValue((v) => (v.startsWith("-") ? v.slice(1) : "-" + v))
              }
            >
              +/− Sign
            </button>
          )}
          <ErrorLine text={error} />
        </form>
        <GuessHistory turns={c.turns} />
      </div>
      <div
        className={"robot " + (last?.hint || "thinking")}
        role="img"
        aria-label="Small arcade robot reacting to the round"
      >
        <i />
        <b />
        <span />
      </div>
    </section>
  );
}
