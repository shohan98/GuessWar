"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Pause, Play } from "lucide-react";
import { scenarios } from "./scenarios.mjs";

export default function HomeBanner({ user }) {
  const [current, setCurrent] = useState(0);
  const [rotating, setRotating] = useState(false);
  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    function applyPreference() {
      setRotating(!motion.matches);
    }
    applyPreference();
    motion.addEventListener("change", applyPreference);
    return () => motion.removeEventListener("change", applyPreference);
  }, []);
  useEffect(() => {
    if (!rotating) return;
    const timer = setInterval(() => {
      if (!document.hidden) setCurrent((n) => (n + 1) % scenarios.length);
    }, 7000);
    return () => clearInterval(timer);
  }, [rotating]);

  const scene = scenarios[current];
  const target = "/create?mode=live&scene=" + scene.id;
  return (
    <section
      className="hero story-hero"
      aria-label="Everyday challenges"
      aria-roledescription="carousel"
    >
      <div className="herocopy">
        <h1>
          {scene.lead}
          <br />
          <em>{scene.accent}</em>
        </h1>
        <p>{scene.copy}</p>
        <div className="actions" onFocus={() => setRotating(false)}>
          <Link
            className="btn primary"
            href={user ? target : "/signup?next=" + encodeURIComponent(target)}
          >
            {scene.action}
            <ArrowUpRight size={17} />
          </Link>
          <Link className="textlink" href="/practice">
            Try a round →
          </Link>
        </div>
      </div>
      <div className="story-photo">
        <img
          src={"/scenes/" + scene.id + ".webp"}
          alt={scene.alt}
          fetchPriority="high"
          width="1080"
          height="720"
        />
        <div className="scene-controls" role="group" aria-label="Banner scenes">
          {scenarios.map((s, i) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={i === current}
              onFocus={() => setRotating(false)}
              onClick={() => {
                setCurrent(i);
                setRotating(false);
              }}
            >
              {s.label}
            </button>
          ))}
          <button
            className="rotation"
            aria-label={rotating ? "Pause slideshow" : "Play slideshow"}
            onClick={() => setRotating(!rotating)}
          >
            {rotating ? <Pause size={16} /> : <Play size={16} />}
          </button>
        </div>
      </div>
    </section>
  );
}
