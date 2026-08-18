// ---- stack rail ----
import { copy, type LayerKey } from "../../lib/data";
import { LAYERS } from "../constants";
import { ctx } from "../ctx";

export function renderRail(onSelect: (key: LayerKey) => void): void {
  const c = ctx();
  c.rail.innerHTML = "";
  for (const key of LAYERS) {
    const l = copy.layers[key];
    const btn = document.createElement("button");
    btn.className = "step";
    btn.setAttribute("aria-current", key === c.current ? "true" : "false");
    btn.innerHTML = `<span class="dot"></span><span><span class="s-name">${l.title}</span><br><span class="s-gloss">${l.gloss}</span></span>`;
    btn.addEventListener("click", () => { onSelect(key); }, { signal: c.ac.signal });
    c.rail.appendChild(btn);
  }
  const l = copy.layers[c.current];
  c.explainer.innerHTML = `<b>${l.title}.</b> ${l.explainer}`;
}
