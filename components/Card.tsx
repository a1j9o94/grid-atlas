"use client";

// The hover card. The engine computes plain-data models (anything registry-
// dependent is already resolved); this renders them.
import { backToFrame, openEvidenceCard, showEventCard } from "../engine/actions";
import { useAtlas, type CardModel, type EvidenceChip, type StatModel } from "../lib/store";

// The receipt for whatever the plate just claimed. Clicking opens the source;
// a chip whose scan is committed also previews it on hover, which is the whole
// point of "show me the original".
function Chips({ chips }: { chips: EvidenceChip[] }) {
  if (chips.length === 0) return null;
  return (
    <div className="ev-chips">
      {chips.map((ch) => (
        <button
          key={ch.id}
          className="ev-chip"
          title={ch.thumb !== undefined ? "Click to read it" : undefined}
          onClick={() => { openEvidenceCard(ch.id); }}
        >
          {ch.glyph} {ch.label}
        </button>
      ))}
    </div>
  );
}

function Stats({ stats }: { stats: StatModel[] }) {
  return (
    <div className="c-stats">
      {stats.map((s, i) => (
        <span key={i} className="c-stat"><b>{s.value}</b>{s.label}</span>
      ))}
    </div>
  );
}

function CardBody({ card }: { card: CardModel }) {
  switch (card.kind) {
    case "region":
      return (
        <>
          <span className="c-swatch" style={{ background: card.swatch }}></span>
          <h3>{card.name}</h3>
          <p className="c-body">{card.body}</p>
          <Stats stats={card.stats} />
          <div className="c-choice">{card.choice}</div>
        </>
      );
    case "state":
      return (
        <>
          <span className="c-swatch" style={{ background: card.swatch }}></span>
          <h3>{card.name}</h3>
          <div className="c-choice">{card.bucketLabel}</div>
          <p className="c-body">{card.body}</p>
          {card.note !== undefined && <p className="c-body c-note">{card.note}</p>}
        </>
      );
    case "wire":
      return (
        <>
          <span className="c-swatch" style={{ background: card.swatch }}></span>
          <h3>{card.name}</h3>
          <div className="c-choice">{card.typeLine}</div>
          <p className="c-body">{card.body}</p>
          <Stats stats={card.stats} />
        </>
      );
    case "wiresIntro":
      return (
        <>
          <h3>Almost 3,000 wire owners</h3>
          <p className="c-body">Every piece on this map is a company that owns poles and wires. Hover any piece to meet it.</p>
          <Stats stats={card.stats} />
        </>
      );
    case "trivia":
      return (
        <>
          <div className="c-kicker">{card.kicker}</div>
          <h3>{card.title}</h3>
          {card.transition && (
            <>
              <div className="transition-status" aria-label={card.transition.ariaLabel}>
                <span><i style={{ background: card.transition.fromSwatch }}></i><b>Before</b>{card.transition.fromRto}</span>
                <span className="transition-arrow">→</span>
                <span><i style={{ background: card.transition.toSwatch }}></i><b>Now</b>{card.transition.toRto}</span>
              </div>
              <p className="transition-date">{card.transition.date}</p>
            </>
          )}
          <p className="c-body">{card.body}</p>
        </>
      );
    case "zipWires":
      return (
        <>
          <h3>Zip {card.zip}</h3>
          <p className="c-body">The dashed line is your zip. Hover the pieces around it to meet the companies that own the wires near you.</p>
        </>
      );
    case "you":
      return (
        <>
          <h3>Zip {card.zip} in the stack</h3>
          <p className="c-body"><b>Your wires:</b> {card.wires}</p>
          {card.choice !== undefined && <div className="c-choice">{card.choice}</div>}
          {card.market !== undefined && <p className="c-body c-note"><b>Your market:</b> {card.market}</p>}
          <p className="c-body c-fine">Zip shapes are the Census version of zip codes. Utility match comes from a 2020 federal lookup.</p>
        </>
      );
    case "frame":
      return (
        <>
          <div className="c-kicker">{card.kicker}</div>
          <h3>{card.title}</h3>
          <p className="c-body">{card.body}</p>
          {card.note !== undefined && <p className="c-body c-note">{card.note}</p>}
          {card.pending && (
            <p className="c-body c-note">
              This plate is still being inked. The words are here. The map for this moment lands in the next update.
            </p>
          )}
          {card.events.length > 0 && (
            <div className="c-events">
              {card.events.map((e) => (
                <button key={e.id} className="c-event" onClick={() => { showEventCard(e.id); }}>
                  <b>{e.year}</b><span>{e.title}</span>
                </button>
              ))}
            </div>
          )}
          <Chips chips={card.evidence} />
        </>
      );
    case "event":
      return (
        <>
          <div className="c-kicker">{card.kicker}</div>
          <h3>{card.title}</h3>
          <p className="c-body">{card.body}</p>
          {card.note !== undefined && <p className="c-body c-note">{card.note}</p>}
          {card.excerpt !== undefined && <Chips chips={[card.excerpt]} />}
          <button className="c-back" onClick={() => { backToFrame(); }}>{card.backLabel}</button>
        </>
      );
    case "dot":
    case "machine":
      return (
        <>
          <div className="c-kicker">{card.kicker}</div>
          <h3>{card.name}</h3>
          <p className="c-body">{card.body}</p>
          {card.note !== undefined && <p className="c-body c-note">{card.note}</p>}
          <Stats stats={card.stats} />
          <button className="c-back" onClick={() => { backToFrame(); }}>{card.backLabel}</button>
        </>
      );
    case "intro":
      return (
        <>
          <h3>{card.title}</h3>
          <p className="c-body">{card.body}</p>
          {card.note && (
            <p className="c-body c-note">
              {card.note.lead !== undefined && <><b>{card.note.lead}</b>{" "}</>}
              {card.note.text}
            </p>
          )}
        </>
      );
  }
}

export default function Card() {
  const card = useAtlas((s) => s.card);
  return (
    <aside className="card" id="card" hidden={card === null}>
      {card && <CardBody card={card} />}
    </aside>
  );
}
