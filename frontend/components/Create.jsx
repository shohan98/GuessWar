"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Swords,
  UserRound,
  UsersRound,
  Plus,
  X,
  Send,
  SlidersHorizontal,
} from "lucide-react";
import { scenarios } from "./scenarios.mjs";
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

export default function Create({ initialMode, initialTeam, sceneId }) {
  const [mode, setMode] = useState(
    ["live", "team"].includes(initialMode) ? initialMode : "duel",
  );
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
  const teamMode = mode === "team";
  const live = mode === "live";
  const stake = scenarios.find((s) => s.id === sceneId)?.commitment || "";
  const [teams, setTeams] = useState(null),
    [teamId, setTeamId] = useState(initialTeam || "");
  const [teamError, setTeamError] = useState(""),
    [reload, setReload] = useState(0);
  useEffect(() => {
    if (!teamMode) return;
    let active = true;
    setTeamError("");
    setTeams(null);
    api("teams")
      .then((d) => {
        if (!active) return;
        setTeams(d.teams);
        setTeamId((id) =>
          d.teams.some((t) => t.id === id)
            ? id
            : !id && d.teams.length === 1
              ? d.teams[0].id
              : "",
        );
      })
      .catch((e) => {
        if (active) setTeamError(e.message);
      });
    return () => {
      active = false;
    };
  }, [teamMode, reload]);
  const selectedTeam = teams?.find((t) => t.id === teamId);
  const waitingForTeam = teamMode && !teams?.length;
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
        numbers: (live ? numbers.slice(0, 1) : numbers).map(Number),
        ...(!live && { tries, seconds }),
        duration_minutes: duration,
        ...(!teamMode ? { emails: [form.emails.trim()] } : { team_id: teamId }),
        win: form.win || "",
        lose: form.lose || "",
        prizes: !teamMode ? [] : prizes,
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
              ["duel", "Single Challenge", UserRound],
              ["live", "Live Duo", Swords],
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
          {!teamMode ? (
            <label>
              Opponent email
              <input
                type="email"
                name="emails"
                placeholder="friend@example.com"
                required
              />
            </label>
          ) : teamError ? (
            <div>
              <ErrorLine text={teamError} />
              <button
                type="button"
                className="textlink"
                onClick={() => setReload((n) => n + 1)}
              >
                Retry loading teams
              </button>
            </div>
          ) : teams === null ? (
            <p className="muted teamloading">Loading teams…</p>
          ) : !teams.length ? (
            <div className="teamempty">
              <UsersRound size={26} />
              <h2>Create your first team</h2>
              <p>
                Save the people you want to invite, then return to set up your
                challenge.
              </p>
              <Link className="btn primary" href="/teams?new=1&from=challenge">
                <Plus size={16} />
                Create team
              </Link>
            </div>
          ) : (
            <>
              <label>
                Team
                <select
                  className="teamselect"
                  value={teamId}
                  required
                  onChange={(e) => setTeamId(e.target.value)}
                >
                  <option value="" disabled>
                    Select a team
                  </option>
                  {teams.map((t) => (
                    <option value={t.id} key={t.id}>
                      {t.name} · {t.emails.length} members
                    </option>
                  ))}
                </select>
              </label>
              {selectedTeam && selectedTeam.emails.length < 2 && (
                <p className="muted">
                  Add at least two members to send a challenge.{" "}
                  <Link className="inlineedit" href="/teams">
                    Manage teams
                  </Link>
                </p>
              )}
            </>
          )}
          {!waitingForTeam && (
            <>
              <div className="buildgroup">
                <h2>{live ? "Your secret number" : "Secret numbers"}</h2>
                <NumberRange
                  live={live}
                  editing={editingRange}
                  onEdit={setEditingRange}
                  low={low}
                  high={high}
                  onChange={(a, b) => setBounds([a, b])}
                />
                <div className="secrets">
                  {(live ? numbers.slice(0, 1) : numbers).map((n, i) => (
                    <div className="secret" key={i}>
                      <label>
                        <span>{live ? "Your number" : "Round " + (i + 1)}</span>
                        <input
                          aria-label={
                            live
                              ? "Your secret number"
                              : "Round " + (i + 1) + " secret number"
                          }
                          value={n}
                          type="number"
                          step="1"
                          min={low}
                          max={high}
                          placeholder="Secret number"
                          required
                          onChange={(e) =>
                            setNumbers(
                              numbers.map((v, j) =>
                                j === i ? e.target.value : v,
                              ),
                            )
                          }
                        />
                      </label>
                      {!live && numbers.length > 1 && (
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
                {!live && numbers.length < 10 && (
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
                <h2>{!teamMode ? "The stakes" : "Ranked prizes"}</h2>
                {!teamMode ? (
                  <div className="twocol">
                    <label>
                      If they win, I’ll…
                      <input
                        defaultValue={stake}
                        name="win"
                        placeholder="Buy them a coffee"
                        maxLength={220}
                        required
                      />
                    </label>
                    <label>
                      If I win, they’ll…
                      <input
                        defaultValue={stake}
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
                              prizes.map((v, j) =>
                                i === j ? e.target.value : v,
                              ),
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
            </>
          )}
        </section>
        {!waitingForTeam && (
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
            {live ? (
              <p className="duo-explainer">
                Each player locks one number. The game picks who goes first.
                Alternate guesses until someone gets it right or the match
                closes.
              </p>
            ) : (
              <>
                {" "}
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
              </>
            )}
            <details className="optionalname">
              <summary>Add a challenge name</summary>
              <label className="sr" htmlFor="challengeName">
                Challenge name
              </label>
              <input
                id="challengeName"
                name="title"
                maxLength={90}
                placeholder={
                  !teamMode
                    ? live
                      ? "Live Duo"
                      : "Single Challenge"
                    : selectedTeam
                      ? selectedTeam.name + " challenge"
                      : "Team challenge"
                }
              />
            </details>
            <ErrorLine text={error} />
            <button
              type="submit"
              className="btn primary full"
              disabled={
                busy ||
                editingRange ||
                (teamMode && (!selectedTeam || selectedTeam.emails.length < 2))
              }
            >
              {busy ? "Sending…" : "Send challenge"}
              <Send size={16} />
            </button>
          </aside>
        )}
      </form>
    </>
  );
}
