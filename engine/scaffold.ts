import { req } from "../lib/assert";
import type { GroupKey } from "./ctx";

// The one write of svg.innerHTML: filters, patterns, and the layer groups in
// stacking order. Everything after this appends into the groups.
export function buildScaffold(svg: SVGSVGElement): { g: Record<GroupKey, SVGGElement>; wobbleDisp: SVGElement } {
  svg.innerHTML = `
  <defs>
    <filter id="wobble" filterUnits="userSpaceOnUse" x="-20" y="-20" width="1020" height="660" primitiveUnits="userSpaceOnUse">
      <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="2" seed="11" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="6.5" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
    <pattern id="hatch-sppwest" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="6" height="6" fill="var(--r-spp)"/>
      <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(38,48,31,0.4)" stroke-width="1.6"/>
    </pattern>
    <pattern id="hatch-transition" width="0.18" height="0.18" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
      <rect width="0.18" height="0.18" fill="var(--r-ercot)"/>
      <line x1="0" y1="0" x2="0" y2="0.18" stroke="rgba(246,238,224,0.95)" stroke-width="0.045"/>
    </pattern>
    <!-- lamplight for the 1900 plate: a city with its own station, and nothing
         between the dots. A gradient rather than a blur filter, because a
         filter in user space would displace at a fixed size the way #wobble
         does. -->
    <radialGradient id="lampglow">
      <stop offset="0%" stop-color="#f2d68a" stop-opacity="0.95"/>
      <stop offset="40%" stop-color="#e0a838" stop-opacity="0.42"/>
      <stop offset="100%" stop-color="#e0a838" stop-opacity="0"/>
    </radialGradient>
    <!-- Confidence, not company identity. Exact and possible assignments use
         the editorial system palette; these two neutral patterns say that a
         filled county could not be assigned to one printed hatch. -->
    <pattern id="holdings-ambiguous" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="6" height="6" fill="#d8dbd1"/>
      <line x1="0" y1="0" x2="0" y2="6" stroke="#696e65" stroke-width="2"/>
    </pattern>
    <pattern id="holdings-unknown" width="5" height="5" patternUnits="userSpaceOnUse">
      <rect width="5" height="5" fill="#d8dbd1"/>
      <line x1="1" y1="0" x2="1" y2="5" stroke="#92988b" stroke-width="1"/>
    </pattern>
  </defs>
  <g id="g-rto" filter="url(#wobble)"></g>
  <g id="g-transitions" filter="url(#wobble)"></g>
  <g id="g-rules" filter="url(#wobble)" hidden></g>
  <g id="g-wires" filter="url(#wobble)" hidden></g>
  <!-- No wobble on the cartogram. The hand-ink filter displaces by an absolute
       6.5px, which would fling a 1px circle several times its own width off
       position and corrupt the area encoding this view exists to show. -->
  <g id="g-cartogram" hidden></g>
  <g id="g-sizekey" hidden></g>
  <g id="g-you" hidden></g>
  <!-- history: the ground for a past plate. Under the state lines, so the
       borders you know still sit on top of a map you do not. -->
  <g id="g-time-base" filter="url(#wobble)" hidden></g>
  <!-- The FTC county trace. County edges stay crisp: applying the 6.5px hand-
       ink displacement to a small eastern county can move it outside itself. -->
  <g id="g-holdings" hidden></g>
  <!-- The three machines, for the mid-century plates. Same wobble as the
       wholesale regions, so a 1967 map is inked like a 2026 one. -->
  <g id="g-seam" filter="url(#wobble)" hidden></g>
  <!-- Market footprints at a past frame. Its own group rather than reusing
       #g-rto, so the wholesale layer's marks are never mutated by a plate and
       Today can never drift from the top of the stack. -->
  <g id="g-membership" filter="url(#wobble)" hidden></g>
  <g id="g-zipoutline"></g>
  <g id="g-statelines"></g>
  <!-- The seam itself, above the state lines, because on these three plates it
       matters more than any border. It keeps #wobble: the filter displaces by
       position in user space, so the line and the region edge it traces get the
       same displacement and stay coincident. -->
  <g id="g-seam-lines" filter="url(#wobble)" hidden></g>
  <g id="g-labels"></g>
  <g id="g-trivia"></g>
  <!-- history marks ride above everything, and never through #wobble: it
       displaces by an absolute 6.5px, which would throw a 2px city dot several
       times its own width off the city it stands for. -->
  <g id="g-time-marks" hidden></g>
`;
  const pick = (sel: string): SVGGElement => req(svg.querySelector<SVGGElement>(sel), sel);
  return {
    g: {
      rto: pick("#g-rto"),
      transitions: pick("#g-transitions"),
      rules: pick("#g-rules"),
      wires: pick("#g-wires"),
      cartogram: pick("#g-cartogram"),
      sizekey: pick("#g-sizekey"),
      you: pick("#g-you"),
      zipoutline: pick("#g-zipoutline"),
      statelines: pick("#g-statelines"),
      labels: pick("#g-labels"),
      trivia: pick("#g-trivia"),
      timeBase: pick("#g-time-base"),
      timeMarks: pick("#g-time-marks"),
      holdings: pick("#g-holdings"),
      seam: pick("#g-seam"),
      membership: pick("#g-membership"),
      seamLines: pick("#g-seam-lines"),
    },
    wobbleDisp: req(svg.querySelector<SVGElement>("#wobble feDisplacementMap"), "#wobble feDisplacementMap"),
  };
}
