#!/usr/bin/env python3
"""Emit the swipe adjudicator as a single self-contained HTML page.

**Persistence, and a bug worth not repeating.** The first build of this page assumed the
`artifact` capability would save DOM changes made by a gesture. That is true only for an
artifact created as a LIVE DOC, where the server stamps `data-id` on every element it
serves. A classic artifact persists nothing unless the page itself calls
`artifact.publish()`. This page did neither, so a reader's session was lost in full.

So persistence here depends on no capability at all. Every pick writes to localStorage
immediately, and the page restores from it on load, so a reload or a closed tab costs
nothing. Handing the verdicts back is an explicit copy: the JSON sits in a selectable
field the reader can copy in one gesture. A published page cannot start a download for a
viewer, and clipboard access can be refused, so the text being visible and selectable is
the floor that always works.

Two methodological choices are baked in here rather than left to the reader.

**Provenance is hidden.** A card never says which candidate came from the primary trace and
which from the independent blind read. Telling the reader that would anchor them to the
machine's answer and destroy the independence the whole exercise exists to buy.

**Side is shuffled per county**, deterministically by FIPS so the page is reproducible.
Without it a reader who noticed that the primary always sits left would anchor on position
instead.

The verdict recorded is the legend key itself, never "A" or "B", so ingestion cannot depend
on remembering which side was which.

  python3 28-build-adjudicator-page.py --in adj.json --out adjudicate.html
"""
import argparse, hashlib, html, json, os

TITLE = 'Hatch Bench'


def side_order(fips, a, b):
    """Deterministic per-county shuffle: same page every build, no positional anchor."""
    h = int(hashlib.sha256(fips.encode()).hexdigest()[:8], 16)
    return (a, b) if h % 2 == 0 else (b, a)


CSS = """
:root{
  /* A reading bench, not a document: the specimen is lit and everything around it recedes.
     Two accents are load-bearing rather than decorative, because every card is one choice
     between two marks, and each mark keeps its colour on the button, the frame and the tally. */
  --ground:#F3F2EE; --raise:#FFFFFF; --edge:#DCD8CE;
  --ink:#1A1B18; --muted:#6E6E66; --faint:#9A998F;
  --pickL:#2F6F8F; --pickL-soft:#DCEAF1;
  --pickR:#A8703A; --pickR-soft:#F4E6D6;
  --neither:#6B5E86; --blank:#7C7B72;
  --shadow:0 1px 2px rgba(26,27,24,.08),0 8px 24px rgba(26,27,24,.07);
}
@media (prefers-color-scheme:dark){
  :root:not([data-theme="light"]){
    --ground:#15171A; --raise:#1E2126; --edge:#2E333A;
    --ink:#E8E4DC; --muted:#9AA0A8; --faint:#6C737C;
    --pickL:#63A9CB; --pickL-soft:#1B2C36;
    --pickR:#D69B5E; --pickR-soft:#33261A;
    --neither:#9E8FC0; --blank:#8A8F98;
    --shadow:0 1px 2px rgba(0,0,0,.4),0 10px 30px rgba(0,0,0,.35);
  }
}
:root[data-theme="dark"]{
  --ground:#15171A; --raise:#1E2126; --edge:#2E333A;
  --ink:#E8E4DC; --muted:#9AA0A8; --faint:#6C737C;
  --pickL:#63A9CB; --pickL-soft:#1B2C36;
  --pickR:#D69B5E; --pickR-soft:#33261A;
  --neither:#9E8FC0; --blank:#8A8F98;
  --shadow:0 1px 2px rgba(0,0,0,.4),0 10px 30px rgba(0,0,0,.35);
}
*{box-sizing:border-box}
body{
  margin:0; background:var(--ground); color:var(--ink);
  font-family:"IBM Plex Sans","Helvetica Neue",Arial,sans-serif;
  font-size:16px; line-height:1.5;
  -webkit-text-size-adjust:100%;
}
.wrap{max-width:760px;margin:0 auto;padding:20px 18px 96px;display:flex;flex-direction:column;gap:18px}
header{display:flex;flex-direction:column;gap:10px}
h1{
  font-size:19px;font-weight:600;margin:0;letter-spacing:-.01em;
  display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;
}
h1 .sub{font-weight:400;color:var(--muted);font-size:14px;letter-spacing:0}
.rail{height:3px;background:var(--edge);border-radius:2px;overflow:hidden}
.rail i{display:block;height:100%;width:0;background:var(--ink);transition:width .18s ease}
.meta{
  display:flex;justify-content:space-between;align-items:baseline;gap:12px;
  font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:12px;color:var(--muted);
  font-variant-numeric:tabular-nums;
}
.stage{position:relative;min-height:340px}
.card{display:none;flex-direction:column;gap:14px}
.card[data-local-on]{display:flex}
.plate{
  background:var(--raise);border:1px solid var(--edge);border-radius:3px;
  box-shadow:var(--shadow);padding:12px;display:flex;flex-direction:column;gap:10px;align-items:center;
}
.plate img{
  display:block;max-width:100%;height:auto;image-rendering:pixelated;
  border:1px solid var(--edge);background:#fff;
}
.county{
  display:flex;align-items:baseline;gap:9px;flex-wrap:wrap;justify-content:center;
  font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:12.5px;color:var(--muted);
}
.county b{font-family:"IBM Plex Sans",sans-serif;font-size:15px;color:var(--ink);font-weight:600}
.choices{display:grid;grid-template-columns:1fr 1fr;gap:10px}
button.pick{
  appearance:none;cursor:pointer;text-align:left;
  background:var(--raise);color:var(--ink);
  border:1px solid var(--edge);border-radius:3px;border-top-width:3px;
  padding:10px;display:flex;gap:10px;align-items:center;
  font:inherit;transition:background .12s ease,border-color .12s ease;
}
button.pick:hover{background:var(--pickL-soft)}
button.pick.r:hover{background:var(--pickR-soft)}
button.pick.l{border-top-color:var(--pickL)}
button.pick.r{border-top-color:var(--pickR)}
button.pick img{
  width:56px;height:56px;flex:0 0 auto;border:1px solid var(--edge);
  image-rendering:pixelated;background:#fff;
}
button.pick .swatch-none{
  width:56px;height:56px;flex:0 0 auto;border:1px dashed var(--edge);background:transparent;
}
button.pick span{display:flex;flex-direction:column;gap:2px;min-width:0}
button.pick .key{
  font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:10.5px;
  letter-spacing:.06em;text-transform:uppercase;color:var(--faint);
}
button.pick .co{font-size:13.5px;font-weight:600;line-height:1.25}
button.pick .desc{font-size:11.5px;color:var(--muted);line-height:1.3}
.aside{display:grid;grid-template-columns:1fr 1fr;gap:10px}
button.alt{
  appearance:none;cursor:pointer;font:inherit;padding:9px 10px;border-radius:3px;
  background:transparent;color:var(--muted);border:1px dashed var(--edge);
  font-size:13px;
}
button.alt:hover{color:var(--ink);border-style:solid}
button.alt.neither{border-left:3px solid var(--neither)}
button.alt.blank{border-left:3px solid var(--blank)}
.keys{
  font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:11.5px;color:var(--faint);
  display:flex;gap:14px;flex-wrap:wrap;justify-content:center;
}
kbd{
  font:inherit;border:1px solid var(--edge);border-bottom-width:2px;border-radius:3px;
  padding:0 4px;color:var(--muted);
}
.done{
  display:none;flex-direction:column;gap:12px;background:var(--raise);
  border:1px solid var(--edge);border-radius:3px;padding:18px;box-shadow:var(--shadow);
}
.done.on{display:flex}
.done h2{margin:0;font-size:16px}
.tally{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:12.5px;color:var(--muted);
  font-variant-numeric:tabular-nums;display:flex;flex-direction:column;gap:3px}
.note{font-size:13px;color:var(--muted);max-width:60ch}
.bar{
  position:fixed;left:0;right:0;bottom:0;background:var(--raise);
  border-top:1px solid var(--edge);padding:9px 16px;
  display:flex;justify-content:space-between;align-items:center;gap:12px;
  font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:12px;color:var(--muted);
  font-variant-numeric:tabular-nums;
}
.bar button{
  appearance:none;cursor:pointer;font:inherit;background:transparent;color:var(--muted);
  border:1px solid var(--edge);border-radius:3px;padding:4px 9px;
}
.bar button:hover{color:var(--ink)}
.bar .saved{color:var(--faint)}
.out{display:none;flex-direction:column;gap:9px}
.out.on{display:flex}
.out textarea{
  width:100%;min-height:150px;font-family:"IBM Plex Mono",ui-monospace,monospace;
  font-size:11.5px;line-height:1.45;padding:10px;border-radius:3px;
  border:1px solid var(--edge);background:var(--ground);color:var(--ink);resize:vertical;
}
.row{display:flex;gap:9px;flex-wrap:wrap;align-items:center}
.row button{
  appearance:none;cursor:pointer;font:inherit;font-size:13px;padding:7px 12px;border-radius:3px;
  background:var(--ink);color:var(--ground);border:1px solid var(--ink);
}
.row button.ghost{background:transparent;color:var(--muted);border-color:var(--edge)}
.row button:hover{opacity:.9}
.row .ok{font-size:12.5px;color:var(--muted)}
/* The third choice. Two candidates cover most cards, but where both readers are wrong the
   reader has to be able to say so, and settling for the nearer of two wrong marks would
   bury exactly the finding worth having.

   It is a panel of engravings, not a dropdown of names, because the task is comparing
   engravings and a native select cannot show one. One panel serves every card: only one
   card shows at a time, and 288 copies of 22 swatches would be 19 MB. */
.palette{border:1px dashed var(--edge);border-radius:3px}
.palette summary{
  cursor:pointer;padding:10px 11px;font-size:13px;color:var(--muted);
  list-style:none;display:flex;justify-content:space-between;align-items:center;gap:10px;
}
.palette summary::-webkit-details-marker{display:none}
.palette summary::after{content:"\25BE";font-size:11px;color:var(--faint)}
.palette[open] summary::after{content:"\25B4"}
.palette summary:hover{color:var(--ink)}
.grid{
  display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));
  gap:8px;padding:0 11px 11px;max-height:54vh;overflow-y:auto;
}
button.tile{
  appearance:none;cursor:pointer;text-align:left;font:inherit;
  background:var(--raise);color:var(--ink);border:1px solid var(--edge);border-radius:3px;
  padding:7px;display:flex;gap:8px;align-items:center;min-width:0;
}
button.tile:hover{border-color:var(--ink)}
button.tile img{
  width:46px;height:46px;flex:0 0 auto;border:1px solid var(--edge);
  image-rendering:pixelated;background:#fff;
}
button.tile .none{
  width:46px;height:46px;flex:0 0 auto;border:1px dashed var(--edge);
  display:grid;place-items:center;font-size:8.5px;color:var(--faint);text-align:center;
  line-height:1.15;padding:2px;
}
button.tile b{font-size:12px;font-weight:600;line-height:1.25;min-width:0;overflow-wrap:anywhere}
:focus-visible{outline:2px solid var(--pickL);outline-offset:2px}
#verdicts{display:none}
@media (max-width:560px){
  .choices{grid-template-columns:1fr}
  button.pick img,button.pick .swatch-none{width:48px;height:48px}
  .keys{display:none}
}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
"""

JS = r"""
(function(){
  var KEY='hatch-bench-v2';
  var cards=[].slice.call(document.querySelectorAll('.card'));
  var rail=document.querySelector('.rail i');
  var pos=document.getElementById('pos');
  var stage=document.getElementById('stage');
  var done=document.getElementById('done');
  var tally=document.getElementById('tally');
  var i=0;

  // Persistence with no capability behind it. A published page cannot rely on the runtime
  // saving DOM changes unless it is a live doc, and it cannot hand a viewer a download, so
  // the durable record is localStorage and the handoff is a copy the reader makes.
  function store(){
    var out={};
    cards.forEach(function(c){
      var v=c.getAttribute('data-verdict');
      if(v){out[c.getAttribute('data-fips')]=v;}
    });
    try{localStorage.setItem(KEY,JSON.stringify({at:i,verdicts:out}));}catch(e){}
    return out;
  }
  function restore(){
    var raw=null;
    try{raw=localStorage.getItem(KEY);}catch(e){return;}
    if(!raw)return;
    var d=null;
    try{d=JSON.parse(raw);}catch(e){return;}
    if(!d||!d.verdicts)return;
    cards.forEach(function(c){
      var v=d.verdicts[c.getAttribute('data-fips')];
      if(v){
        c.setAttribute('data-verdict',v);
        var st=c.querySelector('.state');
        if(st){st.textContent='recorded: '+v;}
      }
    });
    if(typeof d.at==='number'&&d.at>=0&&d.at<=cards.length){i=d.at;}
  }

  function count(){
    var n=0,by={};
    cards.forEach(function(c){
      var v=c.getAttribute('data-verdict');
      if(v){n++;by[v]=(by[v]||0)+1;}
    });
    return {n:n,by:by};
  }
  function paint(){
    cards.forEach(function(c,k){
      if(k===i){c.setAttribute('data-local-on','');}else{c.removeAttribute('data-local-on');}
    });
    var c=count();
    rail.style.width=(100*c.n/cards.length).toFixed(1)+'%';
    pos.textContent=(Math.min(i+1,cards.length))+' / '+cards.length+'  ·  '+c.n+' recorded';
    // Per-viewer position only. Not part of the saved document.
    stage.setAttribute('data-local-at',String(i));
    if(i>=cards.length){finish(c);}else{done.classList.remove('on');}
  }
  function exportJSON(){
    var out=store();
    var ta=document.getElementById('out-json');
    ta.value=JSON.stringify(out,null,1);
    document.getElementById('out').classList.add('on');
    ta.focus(); ta.select();
    var note=document.getElementById('copied');
    if(navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(ta.value).then(function(){
        note.textContent='Copied. Paste it back to Claude.';
      },function(){
        note.textContent='Selected. Copy it and paste it back to Claude.';
      });
    }else{
      note.textContent='Selected. Copy it and paste it back to Claude.';
    }
  }
  function finish(c){
    done.classList.add('on');
    var rows=Object.keys(c.by).sort(function(a,b){return c.by[b]-c.by[a];}).map(function(k){
      return k+'  '+c.by[k];
    });
    tally.textContent='';
    rows.forEach(function(r){var d=document.createElement('div');d.textContent=r;tally.appendChild(d);});
  }
  // The gesture writes the verdict onto the card element itself. That DOM change is the
  // record: it is what saves and what comes back. Nothing here writes on load.
  function record(card,value){
    card.setAttribute('data-verdict',value);
    var st=card.querySelector('.state');
    if(st){st.textContent='recorded: '+value;}
    store();
  }
  function advance(){ if(i<cards.length){i++;} paint(); }

  document.addEventListener('click',function(e){
    var b=e.target.closest('button[data-value]');
    if(b){
      // A palette tile lives outside the cards, so it applies to whichever card is showing.
      var inCard=!!b.closest('.card');
      var card=inCard?b.closest('.card'):cards[i];
      if(card){ record(card,b.getAttribute('data-value')); advance(); }
      if(!inCard){ var pal=document.getElementById('palette'); if(pal){pal.removeAttribute('open');} }
      return;
    }
    if(e.target.closest('#back')){ if(i>0){i--;} paint(); return; }
    if(e.target.closest('#skip')){ advance(); return; }
    if(e.target.closest('#export')||e.target.closest('#export2')){ exportJSON(); return; }
    if(e.target.closest('#reset')){
      if(!confirm('Clear every pick on this device?'))return;
      try{localStorage.removeItem(KEY);}catch(err){}
      cards.forEach(function(c){
        c.setAttribute('data-verdict','');
        var st=c.querySelector('.state'); if(st){st.textContent='';}
      });
      i=0; document.getElementById('out').classList.remove('on'); paint(); return;
    }
  });
  document.addEventListener('keydown',function(e){
    // A focused form control owns its own arrow keys.
    var t=e.target;
    if(t&&(t.tagName==='SELECT'||t.tagName==='INPUT'||t.tagName==='TEXTAREA'))return;
    var card=cards[i]; if(!card) return;
    var map={ArrowLeft:'.l',ArrowRight:'.r',ArrowUp:'.neither',ArrowDown:'.blank'};
    if(map[e.key]){
      var b=card.querySelector('button'+map[e.key]);
      if(b){e.preventDefault();record(card,b.getAttribute('data-value'));advance();}
      return;
    }
    if(e.key==='z'||e.key==='Z'){e.preventDefault();if(i>0){i--;}paint();}
  });
  // Touch: a horizontal drag picks a side, which is the gesture this queue is shaped for.
  var x0=null,y0=null;
  stage.addEventListener('touchstart',function(e){x0=e.touches[0].clientX;y0=e.touches[0].clientY;},{passive:true});
  stage.addEventListener('touchend',function(e){
    if(x0===null)return;
    var dx=e.changedTouches[0].clientX-x0, dy=e.changedTouches[0].clientY-y0;
    x0=null;
    if(Math.abs(dx)<48||Math.abs(dx)<Math.abs(dy))return;
    var card=cards[i]; if(!card)return;
    var b=card.querySelector(dx<0?'button.l':'button.r');
    if(b){record(card,b.getAttribute('data-value'));advance();}
  },{passive:true});

  restore();
  paint();
})();
"""


def card_html(c, refs):
    order = side_order(c['fips'], 'a', 'b')
    out = []
    out.append(f'<article class="card" data-fips="{html.escape(c["fips"])}" data-verdict="">')
    out.append('<div class="plate">')
    out.append(f'<img src="{c["img"]}" alt="County {html.escape(c["fips"])} on the 1932 plate, '
               f'its own boundary drawn in red" width="300">')
    out.append(f'<div class="county"><b>{html.escape(c["name"])}</b>'
               f'<span>{html.escape(c["state"])}</span>'
               f'<span>{html.escape(c["fips"])}</span>'
               f'<span class="state"></span></div>')
    out.append('</div>')
    out.append('<div class="choices">')
    for slot, cls in ((order[0], 'l'), (order[1], 'r')):
        key = c[slot]
        label = c[f'{slot}_label']
        shape = c[f'{slot}_shape']
        img = refs.get(key)
        sw = (f'<img src="{img}" alt="Reference swatch for {html.escape(label)}">' if img
              else '<span class="swatch-none" aria-hidden="true"></span>')
        out.append(
            f'<button class="pick {cls}" data-value="{html.escape(key)}">{sw}'
            f'<span><span class="key">{html.escape(key)}</span>'
            f'<span class="co">{html.escape(label)}</span>'
            f'<span class="desc">{html.escape(shape[:74])}</span></span></button>')
    out.append('</div>')
    out.append('<div class="aside">'
               '<button class="alt neither" data-value="unreadable">Can\'t tell them apart</button>'
               '<button class="alt blank" data-value="none">No fill at all</button>'
               '</div>')

    out.append('</article>')
    return '\n'.join(out)


def main(src, out):
    doc = json.load(open(src))
    cards, refs = doc['cards'], doc['refs']
    marks = doc.get('marks', [])
    ok = sum(1 for c in cards if c['fips'].startswith('40'))
    parts = []
    parts.append(f'<title>{TITLE}</title>')
    parts.append('<link rel="preconnect" href="https://fonts.googleapis.com">'
                 '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
                 '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?'
                 'family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600'
                 '&display=swap">')
    parts.append(f'<style>{CSS}</style>')
    parts.append('<script>window.SWATCH=' + json.dumps(refs) + ';</script>')
    parts.append('<div class="wrap">')
    parts.append('<header>'
                 f'<h1>Hatch Bench<span class="sub">FTC Map IV, 1932 · contested counties</span></h1>'
                 '<div class="rail"><i></i></div>'
                 '<div class="meta"><span id="pos"></span>'
                 f'<span>{ok} Oklahoma first</span></div>'
                 '</header>')
    parts.append('<p class="note">Two readers disagree about every county here. '
                 'Pick the mark whose engraving matches the county inside the red line. '
                 'Which reader chose which is deliberately not shown, and the sides are '
                 'shuffled per county, so there is nothing to anchor to. '
                 'If neither mark is right, open the panel and name the real one rather than '
                 'taking the closer of two wrong answers: a county where both readers missed '
                 'is the most useful thing you can find. '
                 'Picks are kept on this device, so you can stop and come back. '
                 'Press <b>Copy verdicts</b> when you want to hand them over.</p>')
    parts.append('<div class="stage" id="stage">')
    for c in cards:
        parts.append(card_html(c, refs))
    parts.append('</div>')
    tiles = []
    for m in marks:
        img = refs.get(m['key'])
        pic = (f'<img src="{img}" alt="">' if img
               else '<span class="none">no example<br>on plate</span>')
        tiles.append(f'<button class="tile" data-value="{html.escape(m["key"])}" '
                     f'title="{html.escape(m["shape"])}">{pic}'
                     f'<b>{html.escape(m["label"])}</b></button>')
    parts.append('<details class="palette" id="palette">'
                 '<summary>Neither of these. Name the mark from all 24</summary>'
                 '<div class="grid">' + ''.join(tiles) + '</div></details>')
    parts.append('<div class="keys">'
                 '<span><kbd>←</kbd> left mark</span><span><kbd>→</kbd> right mark</span>'
                 '<span><kbd>↑</kbd> can\'t tell</span><span><kbd>↓</kbd> no fill</span>'
                 '<span>Other: open the panel</span>'
                 '<span><kbd>Z</kbd> back</span></div>')
    parts.append('<div class="done" id="done"><h2>Queue finished</h2>'
                 '<div class="tally" id="tally"></div>'
                 '<div class="row"><button id="export2">Copy verdicts</button>'
                 '<span class="ok">Then paste them back to Claude.</span></div></div>')
    parts.append('<div class="out" id="out">'
                 '<textarea id="out-json" readonly '
                 'aria-label="Your verdicts as JSON, ready to copy"></textarea>'
                 '<div class="row"><span class="ok" id="copied"></span>'
                 '<button class="ghost" id="reset">Clear all picks</button></div>'
                 '</div>')
    parts.append('</div>')
    parts.append('<div class="bar"><button id="back">Back</button>'
                 '<span class="saved">Saved on this device as you go</span>'
                 '<button id="export">Copy verdicts</button>'
                 '<button id="skip">Skip</button></div>')
    parts.append(f'<script>{JS}</script>')
    open(out, 'w').write('\n'.join(parts))
    print(f'{len(cards)} cards -> {out}  {os.path.getsize(out)/1e6:.1f} MB')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--in', dest='src', required=True)
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    main(a.src, a.out)
