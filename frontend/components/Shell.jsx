"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUpRight, LogOut } from "lucide-react";
import { Brand, Home, api, ErrorLine, PanelTitle, Ticket } from "./ui";
import Create from "./Create";
import Teams from "./Teams";
import { Dashboard, Host, Invite, Practice } from "./Views";

function Auth({ signup, target, onSuccess }) {
  const [verify, setVerify] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const data = await api(
        "auth/" + (verify ? "verify" : signup ? "signup" : "signin"),
        Object.fromEntries(new FormData(e.currentTarget)),
      );
      if (data.verify) setVerify(true);
      else onSuccess(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  const alternate =
    (signup ? "/signin" : "/signup") + "?next=" + encodeURIComponent(target);
  return (
    <div className="authgrid">
      <div className="authart">
        <Ticket compact />
      </div>
      <section className="panel authbox">
        <PanelTitle
          label="PLAYER ACCESS"
          title={
            verify
              ? "Check your inbox"
              : signup
                ? "Create an account"
                : "Welcome back"
          }
        />
        <form onSubmit={submit} key={String(verify)}>
          {verify ? (
            <>
              <p>Enter the six-digit code we emailed you.</p>
              <label>
                Verification code
                <input
                  name="code"
                  autoFocus
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                />
              </label>
            </>
          ) : (
            <>
              {signup && (
                <label>
                  Display name
                  <input
                    name="name"
                    autoComplete="nickname"
                    maxLength={60}
                    required
                  />
                </label>
              )}
              <label>
                Email address
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                />
              </label>
              <label>
                Password
                <input
                  name="password"
                  type="password"
                  autoComplete={signup ? "new-password" : "current-password"}
                  minLength={signup ? 10 : 1}
                  maxLength={128}
                  required
                />
                {signup && <small>At least 10 characters</small>}
              </label>
            </>
          )}
          <ErrorLine text={error} />
          <button className="btn primary full" disabled={busy}>
            {busy
              ? "Please wait…"
              : verify
                ? "Verify email"
                : signup
                  ? "Create account"
                  : "Sign in"}{" "}
            <ArrowUpRight size={16} />
          </button>
        </form>
        {verify ? (
          <button
            className="textlink"
            onClick={() => {
              setVerify(false);
              setError("");
            }}
          >
            Request a new code
          </button>
        ) : (
          <p>
            {signup ? "Already registered? " : "New to GuessWar? "}
            <Link href={alternate}>{signup ? "Sign in" : "Sign up"}</Link>
          </p>
        )}
      </section>
    </div>
  );
}
export default function Shell({ page, id }) {
  const [user, setUser] = useState(null),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState("");
  const router = useRouter(),
    query = useSearchParams();
  const raw = query.get("next") || "/dashboard";
  const target =
    /^\/(dashboard|teams(?:\?new=1&from=challenge)?|create(?:\?mode=(team|duel)(?:&team=[a-f0-9-]{36})?)?|(?:invite|challenge)\/[a-f0-9-]{36})$/.test(
      raw,
    )
      ? raw
      : "/dashboard";
  const guarded = ["dashboard", "teams", "create", "challenge"].includes(page);
  useEffect(() => {
    api("session")
      .then((d) => setUser(d.user))
      .catch((e) => setError(e.message))
      .finally(() => setLoaded(true));
  }, []);
  useEffect(() => {
    if (loaded && !error && guarded && !user)
      router.replace(
        "/signin?next=" +
          encodeURIComponent(location.pathname + location.search),
      );
  }, [loaded, guarded, user, error, router]);
  async function signout() {
    try {
      await api("auth/logout", {});
      setUser(null);
      router.replace("/");
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <>
      <header className="navbar">
        <div className="navinner">
          <Brand />
          <nav>
            {user ? (
              <>
                <Link href="/dashboard">My challenges</Link>
                <Link
                  href="/teams"
                  aria-current={page === "teams" ? "page" : undefined}
                >
                  Teams
                </Link>
                <button
                  className="iconbtn"
                  aria-label="Sign out"
                  onClick={signout}
                >
                  <LogOut size={17} />
                </button>
              </>
            ) : (
              <>
                <Link href="/signin">Sign in</Link>
                <Link className="navcta" href="/signup">
                  Sign up <ArrowUpRight size={14} />
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main>
        <ErrorLine text={error} />
        {page === "home" ? (
          <Home user={user} />
        ) : page === "practice" ? (
          <Practice />
        ) : !loaded || (guarded && !user) ? (
          <p className="loading">Loading your session…</p>
        ) : page === "signup" || page === "signin" ? (
          <Auth
            key={page}
            signup={page === "signup"}
            target={target}
            onSuccess={(u) => {
              setUser(u);
              router.replace(target);
            }}
          />
        ) : page === "create" ? (
          <Create
            initialMode={query.get("mode")}
            initialTeam={query.get("team")}
          />
        ) : page === "teams" ? (
          <Teams
            key={query.toString()}
            startNew={query.get("new") === "1"}
            fromChallenge={query.get("from") === "challenge"}
          />
        ) : page === "dashboard" ? (
          <Dashboard />
        ) : page === "invite" ? (
          <Invite key={id} id={id} user={user} />
        ) : (
          <Host key={id} id={id} />
        )}
      </main>
      <footer>
        <Brand />
        <span>Private number challenges</span>
      </footer>
    </>
  );
}
