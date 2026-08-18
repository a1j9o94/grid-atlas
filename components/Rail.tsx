"use client";

// ---- stack rail & explainer ----
import { copy } from "../lib/data";
import { getAtlasState, useAtlas } from "../lib/store";
import { LAYERS } from "../engine/constants";
import { setLayer } from "../engine/actions";

export default function Rail() {
  const current = useAtlas((s) => s.layer);
  const l = copy.layers[current];
  return (
    <>
      <div className="steps" id="rail">
        {LAYERS.map((key) => (
          <button
            key={key}
            className="step"
            aria-current={key === current ? "true" : "false"}
            onClick={() => {
              if (getAtlasState().ready) void setLayer(key);
            }}
          >
            <span className="dot"></span>
            <span>
              <span className="s-name">{copy.layers[key].title}</span>
              <br />
              <span className="s-gloss">{copy.layers[key].gloss}</span>
            </span>
          </button>
        ))}
      </div>
      <aside className="explainer" id="explainer">
        <b>{l.title}.</b> {l.explainer}
      </aside>
    </>
  );
}
