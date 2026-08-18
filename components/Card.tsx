"use client";

// The hover card. The engine computes plain-data models (anything registry-
// dependent is already resolved); this renders them.
import { useAtlas, type CardModel, type StatModel } from "../lib/store";

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
