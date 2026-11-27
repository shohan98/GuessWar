"use client";
import Link from "next/link";
import { useCallback, useEffect, useState, useRef } from "react";
import { ArrowRight, ArrowUpRight, Copy, Send, Flag } from "lucide-react";
import { api, PanelTitle, ErrorLine, Rules, Stakes, Ranking, date } from "./ui";
import Arena from "./Arena";

function useResource(path) {
  const [data, setData] = useState(null),
    [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try {
      const d = await api(path);
      setData(d);
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }, [path]);
  useEffect(() => {
    refresh();
  }, [refresh]);
  return { data, setData, error, setError, refresh };
}
function Wait({ error, refresh }) {
  return (
    <div className="panel">
      <p>{error || "Loading…"}</p>
      {error && (
        <button className="btn" onClick={refresh}>
          Retry
        </button>
      )}
    </div>
  );
}
export function Dashboard() {
  const resource = useResource("dashboard"),
    { data } = resource;
  if (!data) return <Wait {...resource} />;
  return (
    <>
      <div className="toprow">
        <PanelTitle label="PLAYER HUB" title="My challenges" />
        <Link className="btn primary" href="/create">
          Create challenge <ArrowUpRight size={16} />
        </Link>
      </div>
      {[
        ["Invitations", data.inbox],
        ["Hosted by you", data.hosted],
      ].map(([title, items]) => (
        <section className="panel listpanel" key={title}>
          <h2>{title}</h2>
          {!items.length ? (
            <p className="muted">
              {title === "Invitations"
                ? "Challenges sent to your email appear here."
                : "Create your first challenge to invite opponents."}
            </p>
          ) : (
            items.map((c) => (
              <Link
                className="matchrow"
                key={c.id || c.invite}
                href={c.invite ? "/invite/" + c.invite : "/challenge/" + c.id}
              >
                <div>
                  <small>
                    {c.mode === "duel" ? "Head-to-head" : "Team challenge"} ·{" "}
                    {c.status || "Host"}
                  </small>
                  <b>{c.title}</b>
                </div>
                <span>
                  {date(c.deadline)} <ArrowRight size={16} />
                </span>
              </Link>
            ))
          )}
        </section>
      ))}
    </>
  );
}
export function Host({ id }) {
  const resource = useResource("challenges/" + id),
    { data: c } = resource,
    [copied, setCopied] = useState("");
  if (!c) return <Wait {...resource} />;
  return (
    <>
      <PanelTitle label="HOST VIEW" title={c.title}>
        <p>Closes {date(c.deadline)}</p>
      </PanelTitle>
      <div className="formgrid">
        <div>
          <section className="panel">
            <div className="toprow">
              <h2>Invited players</h2>
              <button className="textlink" onClick={resource.refresh}>
                Refresh
              </button>
            </div>
            <ErrorLine text={resource.error} />
            {c.players.map((p) => (
              <div className="matchrow" key={p.id}>
                <div>
                  <b>{p.email}</b>
                  <small>
                    {p.status === "invited"
                      ? p.delivered
                        ? "Email sent"
                        : "Email queued"
                      : p.status}
                    {p.status === "finished"
                      ? " · " + p.solved + "/" + c.rounds.length + " solved"
                      : ""}
                  </small>
                </div>
                <button
                  className="iconbtn"
                  aria-label={"Copy invitation for " + p.email}
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(
                        location.origin + "/invite/" + p.id,
                      );
                      setCopied("Invitation link copied.");
                    } catch {
                      setCopied(location.origin + "/invite/" + p.id);
                    }
                  }}
                >
                  <Copy size={16} />
                </button>
              </div>
            ))}
            <small role="status">{copied}</small>
          </section>
          {c.mode === "team" && (
            <section className="panel">
              <h2>Leaderboard</h2>
              <Ranking rows={c.ranking} />
            </section>
          )}
        </div>
        <aside className="panel summary">
          <h2>Challenge rules</h2>
          <Rules c={c} />
          <Stakes c={c} />
        </aside>
      </div>
    </>
  );
}
export function Invite({ id, user }) {
  const resource = useResource("invites/" + id),
    { data: c, setData, error, setError, refresh } = resource;
  const [busy, setBusy] = useState(false);
  async function action(name, body = {}) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      setData(await api("invites/" + id + "/" + name, body));
    } catch (e) {
      setError(e.message);
      if (e.data?.state) setData({ ...e.data.state, own: true });
    } finally {
      setBusy(false);
    }
  }
  if (!c) return <Wait {...resource} />;
  if (c.status === "playing")
    return (
      <>
        <Arena
          c={c}
          onGuess={(value) => action("guess", { value, revision: c.revision })}
          busy={busy}
          onTimeout={refresh}
          error={error}
        />
        {error && (
          <button className="textlink" onClick={refresh}>
            Sync run
          </button>
        )}
      </>
    );
  if (c.status === "finished") {
    const won = c.solved === c.rounds.length;
    return (
      <section className="result panel">
        <Flag className="resulticon" />
        <PanelTitle
          label="RUN COMPLETE"
          title={
            c.mode === "team"
              ? "Run recorded"
              : won
                ? "You won!"
                : "The host wins"
          }
        />
        <div className="resultnum">
          {c.solved}
          <em>/{c.rounds.length}</em>
        </div>
        <p>Rounds solved · {c.revision} tries used</p>
        {c.mode === "duel" ? (
          <div className="pledge">
            <small>Agreed commitment</small>
            <strong>{won ? c.win : c.lose}</strong>
          </div>
        ) : (
          <>
            <Ranking rows={c.ranking} />
            <button className="textlink" onClick={refresh}>
              Refresh ranking
            </button>
          </>
        )}
        <Link className="btn primary" href="/create">
          Create a rematch <ArrowUpRight size={16} />
        </Link>
      </section>
    );
  }
  const target = encodeURIComponent("/invite/" + id);
  return (
    <>
      <PanelTitle
        label={c.mode === "duel" ? "DUEL INVITATION" : "TEAM INVITATION"}
        title={c.title}
      >
        <p>
          Hosted by <strong>{c.host}</strong> · Finish by {date(c.deadline)}
        </p>
      </PanelTitle>
      <div className="formgrid">
        <div className="panel">
          <h2>{c.mode === "duel" ? "The stakes" : "What’s up for grabs"}</h2>
          <Stakes c={c} />
          <h2 className="subhead">Round ranges</h2>
          {c.rounds.map((r, i) => (
            <div className="matchrow" key={i}>
              <span>Round {i + 1}</span>
              <b>
                {r.low} — {r.high}
              </b>
            </div>
          ))}
        </div>
        <aside className="panel summary">
          <h2>Before you play</h2>
          <Rules c={c} />
          <p>
            {c.mode === "duel"
              ? "Solve every round to win the duel."
              : "Highest rounds solved wins. Ties use fewest tries, then fastest total time."}{" "}
            {c.seconds > 0 ? "A timed-out guess uses one try." : ""}
          </p>
          <p>The run starts when you accept. Finish before the deadline.</p>
          <ErrorLine text={error} />
          {c.status === "expired" || c.status === "declined" ? (
            <b>Invitation {c.status}</b>
          ) : !user ? (
            <>
              <Link
                className="btn primary full"
                href={"/signin?next=" + target}
              >
                Sign in to accept <ArrowRight size={16} />
              </Link>
              <Link className="textlink" href={"/signup?next=" + target}>
                Create an account
              </Link>
            </>
          ) : !c.own ? (
            <p>Sign out and use the invited email address to accept.</p>
          ) : (
            <>
              <button
                disabled={busy}
                className="btn primary full"
                onClick={() => action("accept")}
              >
                Accept & start <ArrowRight size={16} />
              </button>
              <button
                className="textlink"
                disabled={busy}
                onClick={() => action("decline")}
              >
                Decline invitation
              </button>
            </>
          )}
        </aside>
      </div>
    </>
  );
}
export function Practice() {
  const secret = useRef(0);
  const [c, setC] = useState(null),
    [done, setDone] = useState(false);
  const start = useCallback(() => {
    secret.current = 1 + Math.floor(Math.random() * 100);
    setDone(false);
    setC({
      mode: "practice",
      title: "Practice round",
      rounds: [{ low: 1, high: 100 }],
      tries: 7,
      seconds: 0,
      turns: [[]],
      revision: 0,
      server_time: new Date().toISOString(),
      clock: new Date(Date.now() + 86400000).toISOString(),
    });
  }, []);
  useEffect(() => {
    start();
  }, [start]);
  if (!c) return null;
  function guess(v) {
    const hint =
      v === secret.current ? "correct" : v > secret.current ? "high" : "low";
    const turns = [[...c.turns[0], { value: v, hint }]];
    setC({ ...c, turns, revision: c.revision + 1 });
    setDone(hint === "correct" || turns[0].length === c.tries);
  }
  if (done)
    return (
      <section className="panel result">
        <Flag className="resulticon" />
        <PanelTitle
          label="PRACTICE COMPLETE"
          title={
            c.turns[0].at(-1).hint === "correct"
              ? "Number cracked!"
              : "Out of tries"
          }
        />
        <div className="resultnum">{secret.current}</div>
        <p>
          {c.revision} of {c.tries} guesses used
        </p>
        <div className="actions">
          <button className="btn primary" onClick={start}>
            Play again
          </button>
          <Link className="textlink" href="/create">
            Challenge a friend <Send size={15} />
          </Link>
        </div>
      </section>
    );
  return <Arena c={c} onGuess={guess} onTimeout={start} />;
}
