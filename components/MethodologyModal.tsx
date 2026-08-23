"use client";

import { setAtlasState, useAtlas } from "../lib/store";
import { useDialog } from "../lib/useDialog";

function close(): void {
  setAtlasState({ modalOpen: false });
}

export default function MethodologyModal() {
  const open = useAtlas((s) => s.modalOpen);
  // Escape used to be handled here, written out a second time; the hook owns
  // that plus the focus handling neither modal had.
  const ref = useDialog<HTMLDivElement>(open, close);
  return (
    <div
      className="modal-backdrop"
      id="method-modal"
      hidden={!open}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div ref={ref} className="modal" role="dialog" aria-modal="true" aria-labelledby="method-title">
        <button className="modal-close" id="method-close" aria-label="Close" onClick={close}>✕</button>
        <h2 id="method-title">How this map is made</h2>
        <p className="note"><b>Where the shapes come from.</b> Utility service areas are federal HIFLD data (2,900+ utilities). Market regions are built by merging those utilities by the market each one belongs to. Zip shapes are the Census version of zip codes. Region borders are honest but not smooth, and blank gaps are areas where no utility is mapped; much of that is wilderness.</p>
        <p className="note"><b>What we fix.</b> The source data has known errors and stale facts. Every correction is documented: the biggest is the City of Caldwell, which really was an Eastern-grid island inside Texas until it joined ERCOT in March 2026. SPP opened a market for a group of western utilities in April 2026; they show as the striped SPP West region, membership verified utility by utility against SPP&apos;s rosters.</p>
        <p className="note"><b>Where the numbers come from.</b> Utility size comes from the EIA&apos;s annual industry report, joined to each territory by utility ID. A count is meters, not people: business and factory meters are in there, so the national total is about 164 million against roughly 131 million homes. Texas needed a fix. A company that only owns wires reports no customers, because there the retailer holds the customer, so the five biggest wire owners in Texas came through blank. Their real counts come from the EIA&apos;s delivery-company table. Where a utility truly reports nothing, the card says so instead of showing a zero.</p>
        <p className="note"><b>Drawing the map by size.</b> On the wires layer you can swap land for size. Every company becomes a circle, and the area of the circle is the amount: meters, electricity, or money. Circles start where the company really is, then push each other apart until none overlap, so crowded corners like the Northeast drift furthest from home. The area is honest; the position is close. Companies too small to see are drawn at a smallest size so they do not vanish, and a few that report nothing are left out. One company, Central Coast Community Energy, was removed from the map entirely: it sells power but owns no wires, and its shape sat entirely on top of PG&amp;E&apos;s.</p>
        <p className="note"><b>Shading the map.</b> The wires layer can also be coloured by time without power, by rooftop solar, and by smart meters. All three come from the same annual report, and each has a gap worth knowing. Reliability is filed by companies covering about four fifths of the country&apos;s meters; the rest report nothing and stay grey. Rooftop solar needed two separate files. Texas has no net metering rule, so no Texas wires company files a net metering form, and the obvious single source would have drawn the second-sunniest large state almost empty. The other file, covering solar outside a net metering tariff, is where Texas keeps its 2,900 megawatts of household panels. Only panels behind a customer&apos;s meter are counted here. Solar farms are generation and belong on a different map.</p>
        <p className="note"><b>What power costs, and why Texas is blank.</b> A bill can be sent by one company or by two. Where one company sells you the power and delivers it, the report has a single number and that is what power costs. Where you are allowed to buy power from somebody else, the seller bills the energy and the wires company bills the delivery, and the report has both halves separately. Adding those two together would double count, and averaging them gives a figure that is neither: for the two dozen largest companies in that position it runs five to sixteen cents per kilowatt hour too low. So the delivery half is kept apart, and the price maps show only what a company billed for the whole service. All of ERCOT is blank on them, because no Texas wires company ever sold anyone power. What Texans actually pay is on the state map, at 14.94 cents a kilowatt hour for households.</p>
        <p className="note"><b>Three classes, never blended.</b> Price is shown one kind of customer at a time, because a single all-in average is the arithmetic nobody pays: it divides a company&apos;s whole book by its whole volume, so a system with a big factory on it reads below what its households are charged, and a residential system reads above. Nationally that blend was 12.76 cents against 15.75 for homes, 12.34 for businesses and 8.05 for industry. Homes come first because that is the bill most people are here about. Businesses means the service sector as the survey counts it, shops and offices and schools, not anything that makes things; the word covers less than it sounds like it does. Industry is factories, mines, refineries and farms, and it pays about half the household rate, because it takes enormous steady load at high voltage and often connects straight to the transmission system, skipping most of the local wires a house depends on. Where the household and industrial maps are furthest apart is where households carry the most of the system&apos;s cost.</p>
        <p className="note"><b>What the blank shapes mean.</b> The price maps leave territories uncoloured for three different reasons, and two of them are marked with a curiosity on the map itself. Only the longer survey form breaks revenue out by customer class, so roughly 1,670 small town utilities and co-ops that file a single lump sum carry no class price at all: that is 1,699 shapes, more than half the companies, and about one meter in forty. Separately, a company that only owns wires never sold anyone power and so has no price to report, which is every Texas delivery company and about 8 million meters. And a company with no factories on it is honestly blank on the industrial map rather than missing from it.</p>
        <p className="note"><b>Cost of the wires.</b> The other price is the delivery charge on its own. Nearly the whole map is blank, and that is the finding rather than a gap. Only a few dozen companies out of almost 3,000 bill delivery separately, because only where customers can shop does anyone have to. In the other thirty-odd states one company sends one bill and how much of it is the poles and wires is not in the public record at all. Two states were dropped from the state version of this for the same reason in reverse: Montana had two households buying power from somebody else and Michigan twenty-one, and a delivery charge worked out from that many people is arithmetic, not a measurement.</p>
        <p className="note"><b>Two things the shading cannot tell you.</b> Companies report solar capacity on one of two bases, alternating or direct current, and the report does not convert between them. The same array rates about a fifth higher on the direct current basis, and there is no way to correct for it from outside. Smart meters are close to all or nothing: a company has either swapped its meters or it has not. That map has five steps and most of the country sits in the top one or the bottom one, which is the finding rather than a flaw in the colours.</p>
        <p className="note"><b>What the marks mean.</b> Every claim on a trivia marker carries sources in the data files. Anything still being checked says so on its card. People counts are rough and marked with ~.</p>
        <p className="note"><b>Who made this.</b> Part of a series on how electricity markets work. I work at Light, which only exists because Texas structured its market a particular way. Judge my arguments accordingly.</p>
        <p className="note"><a href="https://github.com/a1j9o94/grid-atlas" target="_blank" rel="noopener">All code, data, and corrections are public on GitHub ↗</a></p>
      </div>
    </div>
  );
}
