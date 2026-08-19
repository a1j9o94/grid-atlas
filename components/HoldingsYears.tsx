"use client";

// Which source plate the 1930 map is drawing. The plate around it is labelled
// for an era, 1930, while the map under it is one dated printing, so the year
// has to be legible without opening a card. That is what this control is for,
// and it is why the year appears on the button rather than only in the legend.
import { pickHoldingsYear } from "../engine/actions";
import { useAtlas } from "../lib/store";

export default function HoldingsYears() {
  const model = useAtlas((s) => s.holdings);
  // One sheet is not a choice, so the control names it without offering a
  // press. Two or more and it becomes a real switch.
  const single = model !== null && model.years.length === 1;
  return (
    <div className="hy-control" id="holdings-years" hidden={model === null}>
      <span className="hy-label">{model?.label ?? ""}</span>
      <div className="hy-track">
        {(model?.years ?? []).map((y) => (
          <button
            key={y.year}
            className="hy-year"
            aria-pressed={y.pressed}
            disabled={single}
            onClick={() => { pickHoldingsYear(y.year); }}
          >
            <b>{y.label}</b>
            <span className="hy-plate">{y.plate}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
