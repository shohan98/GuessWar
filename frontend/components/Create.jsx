"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Swords,
  UsersRound,
  Plus,
  X,
  Send,
  SlidersHorizontal,
} from "lucide-react";
import NumberRange from "./NumberRange";
import { api, PanelTitle, ErrorLine } from "./ui";

const durations = [
  [10, "10 minutes"],
  [60, "1 hour"],
  [1440, "1 day"],
];
const timers = [
  [0, "No timer"],
  ...[5, 10, 15, 30, 60, 120].map((n) => [n, n + " seconds"]),
];
const attempts = [3, 7, 13, 21].map((n) => [n, n + " tries"]);

function Choice({ label, value, onChange, options }) {
  return (
    <label className="setting">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {options.map(([v, t]) => (
          <option key={v} value={v}>
            {t}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function Create({ initialMode }) {
  const [mode, setMode] = useState(initialMode === "team" ? "team" : "duel");
  const [bounds, setBounds] = useState([1, 1_000]);
  const [low, high] = bounds;
  const [editingRange, setEditingRange] = useState(false);
  const [numbers, setNumbers] = useState([""]);
  const [tries, setTries] = useState(7),
    [seconds, setSeconds] = useState(10),
    [duration, setDuration] = useState(60);
  const [prizes, setPrizes] = useState([""]);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const router = useRouter(),
    requestId = useRef(null);
  const duel = mode === "duel";
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);
    const form = Object.fromEntries(new FormData(event.currentTarget));
    requestId.current ||= crypto.randomUUID();
    try {
      const saved = await api("challenges", {
        request_id: requestId.current,
        mode,
        title: form.title || "",
        low,
        high,
        numbers: numbers.map(Number),
        tries,
        seconds,
        duration_minutes: duration,
        emails: form.emails.split(/[\s,;]+/).filter(Boolean),
        win: form.win || "",
        lose: form.lose || "",
        prizes: duel ? [] : prizes,
      });
      router.push("/challenge/" + saved.id);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }
  return (
    <>
      <PanelTitle label="CHALLENGE STUDIO" title="Create a challenge" />
      <form className="formgrid builder" onSubmit={submit}>
        <section className="panel buildmain">
          <div className="switcher" aria-label="Challenge type">
            {[
              ["duel", "Head-to-head", Swords],
              ["team", "Team challenge", UsersRound],
            ].map(([key, label, Icon]) => (
              <button
                key={key}
                type="button"
                aria-pressed={key === mode}
                className={key === mode ? "selected" : ""}
                onClick={() => setMode(key)}
              >
                <Icon size={17} />
                {label}
              </button>
            ))}
          </div>
          <label>
            {duel ? "Opponent email" : "Team emails"}
            {duel ? (
              <input
                type="email"
                key="duel"
                name="emails"
                placeholder="friend@example.com"
                required
              />
            ) : (
              <textarea
                key="team"
                name="emails"
                rows={2}
                placeholder="Separate teammates’ emails with commas"
                required
              />
            )}
          </label>
          <div className="buildgroup">
            <h2>Secret numbers</h2>
            <NumberRange
              editing={editingRange}
              onEdit={setEditingRange}
              low={low}
              high={high}
              onChange={(a, b) => setBounds([a, b])}
            />
            <div className="secrets">
              {numbers.map((n, i) => (
                <div className="secret" key={i}>
                  <label>
                    <span>Round {i + 1}</span>
                    <input
                      aria-label={"Round " + (i + 1) + " secret number"}
                      value={n}
                      type="number"
                      step="1"
                      min={low}
                      max={high}
                      placeholder="Secret number"
                      required
                      onChange={(e) =>
                        setNumbers(
                          numbers.map((v, j) => (j === i ? e.target.value : v)),
                        )
                      }
                    />
                  </label>
                  {numbers.length > 1 && (
                    <button
                      className="iconbtn"
                      type="button"
                      aria-label={"Remove round " + (i + 1)}
                      onClick={() =>
                        setNumbers(numbers.filter((_, j) => i !== j))
                      }
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {numbers.length < 10 && (
              <button
                type="button"
                className="add"
                onClick={() => setNumbers([...numbers, ""])}
              >
                <Plus size={16} /> Add round
              </button>
            )}
          </div>
          <div className="buildgroup">
            <h2>{duel ? "The stakes" : "Ranked prizes"}</h2>
            {duel ? (
              <div className="twocol">
                <label>
                  If they win, I’ll…
                  <input
                    name="win"
                    placeholder="Buy them a coffee"
                    maxLength={220}
                    required
                  />
                </label>
                <label>
                  If I win, they’ll…
                  <input
                    name="lose"
                    placeholder="Pick Friday’s playlist"
                    maxLength={220}
                    required
                  />
                </label>
              </div>
            ) : (
              <>
                {prizes.map((p, i) => (
                  <label key={i}>
                    Rank {i + 1} prize
                    <input
                      required
                      value={p}
                      maxLength={220}
                      onChange={(e) =>
                        setPrizes(
                          prizes.map((v, j) => (i === j ? e.target.value : v)),
                        )
                      }
                    />
                  </label>
                ))}
                <div className="actions">
                  {prizes.length < 10 && (
                    <button
                      type="button"
                      className="add"
                      onClick={() => setPrizes([...prizes, ""])}
                    >
                      <Plus size={15} />
                      Add rank
                    </button>
                  )}
                  {prizes.length > 1 && (
                    <button
                      type="button"
                      className="add"
                      onClick={() => setPrizes(prizes.slice(0, -1))}
                    >
                      Remove last rank
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </section>
        <aside className="panel summary buildsettings">
          <h2>
            <SlidersHorizontal size={20} />
            Game settings
          </h2>
          <Choice
            label="Open for"
            value={duration}
            onChange={setDuration}
            options={durations}
          />
          <small>The clock starts when you send.</small>
          <Choice
            label="Tries per round"
            value={tries}
            onChange={setTries}
            options={attempts}
          />
          <Choice
            label="Time per guess"
            value={seconds}
            onChange={setSeconds}
            options={timers}
          />
          <details className="optionalname">
            <summary>Add a challenge name</summary>
            <label className="sr" htmlFor="challengeName">
              Challenge name
            </label>
            <input
              id="challengeName"
              name="title"
              maxLength={90}
              placeholder={duel ? "Head-to-head challenge" : "Team challenge"}
            />
          </details>
          <ErrorLine text={error} />
          <button
            type="submit"
            className="btn primary full"
            disabled={busy || editingRange}
          >
            {busy ? "Sending…" : "Send challenge"}
            <Send size={16} />
          </button>
        </aside>
      </form>
    </>
  );
}
