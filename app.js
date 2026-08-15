// The explorable market map. v0: skeleton — rail from copy.json, map comes next.
const LAYERS = ["wholesale", "rules", "wires", "you"];

const copy = await (await fetch("data/copy.json")).json();

// stack rail
const rail = document.getElementById("rail");
const explainer = document.getElementById("explainer");
let current = "wholesale";

function renderRail() {
  rail.innerHTML = "";
  for (const key of LAYERS) {
    const l = copy.layers[key];
    const btn = document.createElement("button");
    btn.className = "step";
    btn.setAttribute("aria-current", key === current ? "true" : "false");
    btn.innerHTML = `<span class="dot"></span><span><span class="s-name">${l.title}</span><br><span class="s-gloss">${l.gloss}</span></span>`;
    btn.addEventListener("click", () => setLayer(key));
    rail.appendChild(btn);
  }
  const l = copy.layers[current];
  explainer.innerHTML = `<b>${l.title}.</b> ${l.explainer}`;
}

function setLayer(key) {
  current = key;
  renderRail();
}

renderRail();
