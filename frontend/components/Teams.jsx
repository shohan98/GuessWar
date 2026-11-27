"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Pencil, Plus, Trash2, UsersRound } from "lucide-react";
import { api, ErrorLine, PanelTitle } from "./ui";

function TeamEditor({ team, fromChallenge, onSaved, onCancel }) {
  const [name, setName] = useState(team?.name || "");
  const [members, setMembers] = useState(team?.emails.join("\n") || "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const requestId = useRef(null);
  async function save(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const payload = {
        name,
        emails: members
          .trim()
          .split(/[\s,;]+/)
          .filter(Boolean),
      };
      if (!team) {
        requestId.current ||= crypto.randomUUID();
        payload.request_id = requestId.current;
      }
      const saved = team
        ? await api("teams/" + team.id, payload, "PUT")
        : await api("teams", payload);
      onSaved(saved);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }
  return (
    <form className="panel teameditor" onSubmit={save}>
      <h2>{team ? "Edit team" : "Create a team"}</h2>
      <label>
        Team name
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={72}
          placeholder="Friday crew"
        />
      </label>
      <label>
        Member emails
        <textarea
          rows={4}
          value={members}
          onChange={(e) => setMembers(e.target.value)}
          placeholder="alex@example.com, sam@example.com"
        />
        <small>
          Separate addresses with commas or new lines. A team challenge needs at
          least two members.
        </small>
      </label>
      <ErrorLine text={error} />
      <div className="actions">
        <button className="btn primary" disabled={busy}>
          {busy
            ? "Saving…"
            : fromChallenge
              ? "Save & return to challenge"
              : "Save team"}
        </button>
        <button
          className="textlink"
          type="button"
          onClick={onCancel}
          disabled={busy}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function Teams({ startNew, fromChallenge }) {
  const router = useRouter();
  const [teams, setTeams] = useState(null),
    [editing, setEditing] = useState(startNew ? "new" : null);
  const [confirm, setConfirm] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function load() {
    try {
      const d = await api("teams");
      setTeams(d.teams);
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, []);
  function saved(team) {
    if (fromChallenge) {
      router.push("/create?mode=team&team=" + team.id);
      return;
    }
    setTeams((items) =>
      [...(items || []).filter((t) => t.id !== team.id), team].sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    );
    setEditing(null);
    setError("");
  }
  function cancel() {
    if (fromChallenge) router.push("/create?mode=team");
    else setEditing(null);
  }
  async function remove(id) {
    if (busy) return;
    setBusy(true);
    try {
      await api("teams/" + id, undefined, "DELETE");
      setTeams((items) => items.filter((t) => t.id !== id));
      setConfirm(null);
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="teamspage">
      <div className="toprow">
        <PanelTitle label="PLAYER HUB" title="Teams" />
        {!editing && teams?.length > 0 && (
          <button
            className="btn primary"
            onClick={() => {
              setEditing("new");
              setConfirm(null);
            }}
          >
            <Plus size={16} />
            Create team
          </button>
        )}
      </div>
      <ErrorLine text={error} />
      {teams === null ? (
        <div className="panel">
          {error ? (
            <button className="textlink" onClick={load}>
              Retry
            </button>
          ) : (
            "Loading teams…"
          )}
        </div>
      ) : editing ? (
        <TeamEditor
          key={editing}
          team={teams.find((t) => t.id === editing)}
          fromChallenge={fromChallenge}
          onSaved={saved}
          onCancel={cancel}
        />
      ) : teams.length === 0 ? (
        <div className="panel teamempty">
          <UsersRound size={26} />
          <h2>Your first team</h2>
          <p>Save a roster to invite the same people to future challenges.</p>
          <button className="btn primary" onClick={() => setEditing("new")}>
            <Plus size={16} />
            Create team
          </button>
        </div>
      ) : (
        <section className="panel teamlist">
          {teams.map((t) => (
            <article key={t.id}>
              <div className="teamline">
                <span className="teamglyph">
                  <UsersRound size={22} />
                </span>
                <div className="teamtitle">
                  <h2>{t.name}</h2>
                  <small>
                    {t.emails.length}{" "}
                    {t.emails.length === 1 ? "member" : "members"}
                  </small>
                </div>
                <button
                  className="iconbtn"
                  aria-label={"Edit " + t.name}
                  title="Edit team"
                  onClick={() => {
                    setEditing(t.id);
                    setConfirm(null);
                  }}
                >
                  <Pencil size={16} />
                </button>
                <button
                  className="iconbtn"
                  aria-label={"Delete " + t.name}
                  title="Delete team"
                  disabled={busy}
                  onClick={() => setConfirm(t.id)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
              {confirm === t.id ? (
                <div className="teamconfirm">
                  <p>
                    Delete {t.name}? Challenges already sent keep their players
                    and results.
                  </p>
                  <div className="actions">
                    <button
                      className="btn"
                      disabled={busy}
                      onClick={() => remove(t.id)}
                    >
                      Confirm delete
                    </button>
                    <button
                      className="textlink"
                      disabled={busy}
                      onClick={() => setConfirm(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                t.emails.length >= 2 && (
                  <Link
                    className="textlink teamplay"
                    href={"/create?mode=team&team=" + t.id}
                  >
                    Challenge this team <ArrowRight size={15} />
                  </Link>
                )
              )}
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
