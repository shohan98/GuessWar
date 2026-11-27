"use client";
import { useState } from "react";

export default function NumberRange({ low, high, onChange, editing, onEdit }) {
  const [scale, setScale] = useState([1, 100]);
  const [draft, setDraft] = useState(["", ""]);
  const [error, setError] = useState("");
  function apply() {
    const values = draft.map(Number);
    const [a, b] = values;
    if (
      draft.some((s) => !s.trim()) ||
      !values.every(Number.isInteger) ||
      a < -999999 ||
      b > 999999 ||
      a >= b
    ) {
      setError(
        "Choose two whole numbers from −999999 to 999999, with the minimum below the maximum.",
      );
      return;
    }
    setScale([Math.min(1, a), Math.max(100, b)]);
    onChange(a, b);
    onEdit(false);
  }
  const span = scale[1] - scale[0];
  return (
    <div className="rangebox">
      <div className="rangeheading">
        <strong>Number range</strong>
        <output>
          {low} – {high}
        </output>
      </div>
      <div
        className="dualslider"
        style={{
          "--start": ((low - scale[0]) / span) * 100 + "%",
          "--end": ((high - scale[0]) / span) * 100 + "%",
        }}
      >
        <div className="sliderrail">
          <i />
        </div>
        <input
          type="range"
          disabled={editing}
          aria-label="Minimum number"
          min={scale[0]}
          max={scale[1]}
          value={low}
          style={{ zIndex: low > scale[0] + span / 2 ? 3 : 1 }}
          onChange={(e) => onChange(Math.min(+e.target.value, high - 1), high)}
        />
        <input
          type="range"
          disabled={editing}
          aria-label="Maximum number"
          min={scale[0]}
          max={scale[1]}
          value={high}
          onChange={(e) => onChange(low, Math.max(+e.target.value, low + 1))}
        />
      </div>
      <div className="rangefoot">
        <small>Shared by every round</small>
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
