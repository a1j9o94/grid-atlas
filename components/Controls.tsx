"use client";

// The three control groups. The engine computes the option models (they hang
// off lazily loaded registries); these render them and call straight back
// into the engine's actions.
import { setColourBy, setShadeBy, setSizeBy, setVariant } from "../engine/actions";
import { useAtlas, type ControlOption } from "../lib/store";

function Buttons({ options, attr, alt = false, onPick }: {
  options: ControlOption[];
  attr: string;
  alt?: boolean;
  onPick: (key: string) => void;
}) {
  return options.map((o) => (
    <button
      key={o.key}
      className={alt ? "sz-btn sz-alt" : "sz-btn"}
      aria-pressed={o.pressed}
      {...{ [`data-${attr}`]: o.key }}
      onClick={() => { onPick(o.key); }}
    >
      {o.label}
    </button>
  ));
}

export function ShadeControls() {
  const layer = useAtlas((s) => s.layer);
  const model = useAtlas((s) => s.shadeControls);
  return (
    <div className="size-controls" id="shade-controls" hidden={layer !== "rules"}>
      {model && (
        <>
          <span className="sz-label">{model.label}</span>
          <Buttons options={model.options} attr="shade" onPick={(k) => { setShadeBy(k); }} />
        </>
      )}
    </div>
  );
}

export function ColourControls() {
  const layer = useAtlas((s) => s.layer);
  const model = useAtlas((s) => s.colourControls);
  return (
    <div className="size-controls" id="colour-controls" hidden={layer !== "wires"}>
      {model && (
        <>
          <span className="sz-label">{model.label}</span>
          <Buttons options={model.options} attr="colour" onPick={(k) => { setColourBy(k); }} />
          {model.variants && (
            <span className="sz-sub">
              <Buttons options={model.variants} attr="variant" alt onPick={(k) => { setVariant(k); }} />
            </span>
          )}
        </>
      )}
    </div>
  );
}

export function SizeControls() {
  const layer = useAtlas((s) => s.layer);
  const model = useAtlas((s) => s.sizeControls);
  return (
    <div className="size-controls" id="size-controls" hidden={layer !== "wires"}>
      {model && (
        <>
          <span className="sz-label">{model.label}</span>
          {/* the land option carries the empty key, meaning "no measure" */}
          <Buttons options={model.options} attr="size" onPick={(k) => { setSizeBy(k === "" ? null : k); }} />
        </>
      )}
    </div>
  );
}
