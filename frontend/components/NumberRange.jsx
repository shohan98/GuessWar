"use client";
import { useState } from "react";

const MAX_NUMBER = 1_000_000;
const format = new Intl.NumberFormat("en-US").format;

// Each interval gets equal space so smaller ranges remain easy to drag on a phone.
const positiveStops = [1, 100, 1_000, 10_000, 100_000, MAX_NUMBER];

function positionOf(value, stops) {
  const upper = stops.findIndex((stop) => stop >= value);
  if (upper === 0) return 0;
  return (
    upper - 1 + (value - stops[upper - 1]) / (stops[upper] - stops[upper - 1])
  );
}

function numberAt(position, stops) {
  const index = Math.min(Math.floor(position), stops.length - 2);
  return Math.round(
    stops[index] + (position - index) * (stops[index + 1] - stops[index]),
  );
}

export default function NumberRange({ low, high, onChange, editing, onEdit }) {
  const [minimum, setMinimum] = useState(1);
  const stops = minimum < 1 ? [minimum, ...positiveStops] : positiveStops;
  const [draft, setDraft] = useState(["", ""]);
  const [error, setError] = useState("");
  function apply() {
    const values = draft.map(Number);
    const [a, b] = values;
    if (
      draft.some((s) => !s.trim()) ||
      !values.every(Number.isInteger) ||
      a < -999999 ||
      b > MAX_NUMBER ||
      a >= b
    ) {
      setError(
        "Choose two whole numbers from −999,999 to 1,000,000, with the minimum below the maximum.",
      );
      return;
    }
    setMinimum(Math.min(1, a));
    onChange(a, b);
    onEdit(false);
  }
  const end = stops.length - 1;
  const startPosition = positionOf(low, stops);
  const endPosition = positionOf(high, stops);
  const handles = [
    {
      label: "Minimum number",
      value: low,
      position: startPosition,
      min: minimum,
      max: high - 1,
      update: (value) => onChange(value, high),
    },
    {
      label: "Maximum number",
      value: high,
      position: endPosition,
      min: low + 1,
      max: MAX_NUMBER,
      update: (value) => onChange(low, value),
    },
  ];
  return (
    <div className="rangebox">
      <div className="rangeheading">
        <strong>Number range</strong>
        <output>
          {format(low)} – {format(high)}
        </output>
      </div>
      <div
        className="dualslider"
        style={{
          "--start": (startPosition / end) * 100 + "%",
          "--end": (endPosition / end) * 100 + "%",
        }}
      >
        <div className="sliderrail">
          <i />
        </div>
        {handles.map((handle) => {
          function update(value) {
            handle.update(Math.max(handle.min, Math.min(handle.max, value)));
          }
          return (
            <input
              key={handle.label}
              type="range"
              disabled={editing}
              aria-label={handle.label}
              aria-valuemin={handle.min}
              aria-valuemax={handle.max}
              aria-valuenow={handle.value}
              aria-valuetext={format(handle.value)}
              min={0}
              max={end}
              step="any"
              value={handle.position}
              style={{
                zIndex:
                  handle.label === "Minimum number" && startPosition > end / 2
                    ? 3
                    : undefined,
              }}
              onChange={(event) =>
                update(numberAt(Number(event.target.value), stops))
              }
              onKeyDown={(event) => {
                const deltas = {
                  ArrowLeft: -1,
                  ArrowDown: -1,
                  ArrowRight: 1,
                  ArrowUp: 1,
                };
                if (event.key in deltas) {
                  event.preventDefault();
                  update(handle.value + deltas[event.key]);
                }
              }}
            />
          );
        })}
      </div>
      <div className="rangefoot">
        <small>All rounds · Up to 1M</small>
        <button
          className="inlineedit"
          type="button"
          aria-expanded={editing}
          onClick={() => {
            setDraft([String(low), String(high)]);
            setError("");
            onEdit(!editing);
          }}
        >
          {editing ? "Cancel" : "Custom range"}
        </button>
      </div>
      {editing && (
        <div className="rangeedit">
          <div className="twocol">
            {["Minimum", "Maximum"].map((t, i) => (
              <label key={t}>
                {t}
                <input
                  type="number"
                  step="1"
                  value={draft[i]}
                  onChange={(e) =>
                    setDraft(
                      draft.map((v, j) => (j === i ? e.target.value : v)),
                    )
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      apply();
                    }
                  }}
                />
              </label>
            ))}
          </div>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <button type="button" className="btn" onClick={apply}>
            Apply range
          </button>
        </div>
      )}
    </div>
  );
}
