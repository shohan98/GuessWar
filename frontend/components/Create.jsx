"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Swords,
  UsersRound,
  Plus,
  Minus,
  Send,
  Ticket as TicketIcon,
} from "lucide-react";
import { api, PanelTitle, ErrorLine, Rules } from "./ui";

function tomorrow() {
  const d = new Date(Date.now() + 86400000);
  return new Date(+d - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
export default function Create({ initialMode }) {
  const [mode, setMode] = useState(initialMode === "team" ? "team" : "duel"),
    [rounds, setRounds] = useState([{ low: 1, high: 100, target: "" }]);
  const [tries, setTries] = useState(7),
    [seconds, setSeconds] = useState(10),
    [prizes, setPrizes] = useState([""]);
  const [title, setTitle] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const requestId = useRef(null),
    router = useRouter();
  function changeRound(index, key, value) {
    setRounds((rows) =>
      rows.map((r, i) => (i === index ? { ...r, [key]: value } : r)),
    );
  }
  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const d = Object.fromEntries(new FormData(e.currentTarget));
    requestId.current ||= crypto.randomUUID();
    try {
      const saved = await api("challenges", {
        request_id: requestId.current,
        title,
        mode,
        rounds,
        tries,
        seconds,
        deadline: new Date(d.deadline).toISOString(),
        emails: d.emails.split(/[\s,;]+/).filter(Boolean),
        win: d.win || "",
        lose: d.lose || "",
        prizes: mode === "team" ? prizes : [],
      });
      router.push("/challenge/" + saved.id);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }
  return (
    <>
      <PanelTitle label="CHALLENGE STUDIO" title="Create a challenge" />
      <form className="formgrid" onSubmit={submit}>
        <div className="formsections">
          <section className="panel">
            <h2>Match setup</h2>
            <div className="switcher">
              {[
                ["duel", "Head-to-head", Swords],
                ["team", "Team challenge", UsersRound],
              ].map(([v, t, Icon]) => (
                <button
                  type="button"
                  key={v}
                  aria-pressed={mode === v}
                  className={mode === v ? "selected" : ""}
                  onClick={() => setMode(v)}
                >
                  <Icon size={16} />
                  {t}
                </button>
              ))}
            </div>
            <label>
              Challenge name
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Friday coffee showdown"
                maxLength={90}
                required
              />
            </label>
            <label>
              {mode === "duel" ? "Opponent email" : "Team emails"}
              <textarea
                key={mode}
                name="emails"
                rows={mode === "duel" ? 1 : 2}
                placeholder={
                  mode === "duel"
                    ? "friend@example.com"
                    : "Separate addresses with commas or new lines"
                }
                required
              />
            </label>
            <label>
              Finish by{" "}
              <input
                name="deadline"
                type="datetime-local"
                defaultValue={tomorrow()}
                required
              />
              <small>Your local time</small>
            </label>
          </section>
          <section className="panel">
            <h2>Rounds & limits</h2>
            <div className="twocol">
              <label>
                Max tries per round
                <input
                  type="number"
                  min="1"
                  max="20"
                  required
                  value={tries}
                  onChange={(e) => setTries(e.target.value)}
                />
              </label>
              <label>
                Seconds per guess
                <input
                  type="number"
                  min="0"
                  max="120"
                  required
                  value={seconds}
                  onChange={(e) => setSeconds(e.target.value)}
                />
                <small>0 turns off this timer</small>
              </label>
            </div>
            {rounds.map((r, i) => (
              <div className="roundentry" key={i}>
                <div className="roundlabel">
                  Round {i + 1}
                  {rounds.length > 1 && (
                    <button
                      aria-label={"Remove round " + (i + 1)}
                      type="button"
                      onClick={() =>
                        setRounds(rounds.filter((_, j) => j !== i))
                      }
                    >
                      <Minus size={15} />
                    </button>
                  )}
                </div>
                <div className="threecol">
                  {[
                    ["low", "Min"],
                    ["high", "Max"],
                    ["target", "Secret number"],
                  ].map(([k, t]) => (
                    <label key={k}>
                      {t}
                      <input
                        type="number"
                        required
                        value={r[k]}
                        min={k === "target" ? r.low : -999999}
                        max={k === "target" ? r.high : 999999}
                        onChange={(e) => changeRound(i, k, e.target.value)}
                      />
                    </label>
                  ))}
                </div>
              </div>
            ))}
            {rounds.length < 10 && (
              <button
                className="add"
                type="button"
                onClick={() =>
                  setRounds([...rounds, { low: 1, high: 100, target: "" }])
                }
              >
                <Plus size={15} />
                Add round
              </button>
            )}
          </section>
          <section className="panel">
            <h2>{mode === "duel" ? "Your commitments" : "Ranked prizes"}</h2>
            {mode === "duel" ? (
              <>
                <label>
                  If your opponent solves every round, what will you do?
                  <input
                    name="win"
                    placeholder="I’ll buy them coffee."
                    required
                    maxLength={220}
                  />
                </label>
                <label>
                  If they fall short, what will they do?
                  <input
                    name="lose"
                    placeholder="They’ll pick our next team playlist."
                    required
                    maxLength={220}
                  />
                </label>
              </>
            ) : (
              <>
                {prizes.map((p, i) => (
                  <label key={i}>
                    Rank {i + 1} prize
                    <input
                      value={p}
                      required
                      maxLength={220}
                      onChange={(e) =>
                        setPrizes(
                          prizes.map((x, j) => (j === i ? e.target.value : x)),
                        )
                      }
                    />
                  </label>
                ))}
                <div className="actions">
                  {prizes.length < 10 && (
                    <button
                      className="add"
                      type="button"
                      onClick={() => setPrizes([...prizes, ""])}
                    >
                      <Plus size={15} />
                      Add rank
                    </button>
                  )}
                  {prizes.length > 1 && (
                    <button
                      className="add"
                      type="button"
                      onClick={() => setPrizes(prizes.slice(0, -1))}
                    >
                      Remove last rank
                    </button>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
        <aside className="panel summary">
          <span className="eyebrow">
            <TicketIcon size={15} /> INVITE PREVIEW
          </span>
          <h2>{title || "Your challenge"}</h2>
          <p>{mode === "duel" ? "Head-to-head duel" : "Team challenge"}</p>
          <Rules c={{ rounds, tries, seconds: Number(seconds) }} />
          <p className="muted">
            Sending locks the numbers, rules, and rewards for all players.
          </p>
          <ErrorLine text={error} />
          <button disabled={busy} className="btn primary full">
            {busy ? "Creating…" : "Create & invite"}
            <Send size={16} />
          </button>
        </aside>
      </form>
    </>
  );
}
