// Brigata — inventario del magazzino con valore della merce
// Si contano i prodotti frigo per frigo; alla conferma le quantità si aggiornano e resta
// lo storico con il valore (calcolato dai prezzi degli ingredienti con lo stesso nome).
'use strict';

let invQ = '';   // filtro di ricerca
const invKey = () => 'br_inv:' + STORE;
const invDraft = () => { try { return JSON.parse(localStorage.getItem(invKey())); } catch (e) { return null; } };
const invSave = d => { try { if (d) localStorage.setItem(invKey(), JSON.stringify(d)); else localStorage.removeItem(invKey()); } catch (e) {} };

// valore di una quantità: prezzo dell'ingrediente con lo stesso nome (al kg, al litro o al pezzo)
function prVal(n, u, q) {
  const i = S.ing.find(x => x.n.toLowerCase() == String(n).trim().toLowerCase());
  if (!i || !i.p) return null;
  q = +q || 0;
  if (i.u == 'pz') return u == 'pz' ? q * i.p : null;
  if (u == 'g' || u == 'ml') return q / 1000 * i.p;
  if (u == 'kg' || u == 'l') return q * i.p;
  return null;
}

function invStart() {
  const d = invDraft();
  if (d && !confirm('C\'è un inventario iniziato il ' + dm(d.d) + '. Ricominciare da capo?')) { draw(); return; }
  invSave({d:today(), c:{}});
  invQ = ''; draw();
}

function vInv() {
  const d = invDraft(), C = can('cost');
  const back = `<button class=g data-a=xmb style="margin-bottom:10px">‹ Magazzino</button>`;
  if (!d) {
    const H = [...S.inv].sort((a, b) => b.d.localeCompare(a.d));
    return back + `<div class=card><b>Inventario</b><div class=m style="margin:4px 0 10px">Conta la merce frigo per frigo: le quantità del magazzino si aggiornano e resta lo storico${C ? ' con il valore della merce' : ''}. Puoi interrompere e riprendere quando vuoi.</div><button data-a=invs class=w>Inizia inventario</button></div>`
      + (H.length ? `<div class=card><b>Inventari fatti</b>${H.map((x, i) => { const p = H[i + 1]; return `<div class=li data-a=invd data-id=${x.id} style="cursor:pointer"><div class=row><span>${new Date(x.d + 'T12:00').toLocaleDateString('it', {day:'numeric', month:'long', year:'numeric'})}</span>${C ? `<b>${eur(x.tot)}</b>` : `<span class=m>${x.r.length} prodotti</span>`}</div><div class=m style="font-size:12px">${esc(x.by || '')}${C && p ? ` · ${x.tot >= p.tot ? '+' : ''}${eur(x.tot - p.tot)} rispetto al precedente` : ''}${C && x.nv ? ` · ${x.nv} senza prezzo` : ''}</div></div>`; }).join('')}</div>` : '');
  }
  const L = S.pr.filter(p => !invQ || p.n.toLowerCase().includes(invQ.toLowerCase()));
  const cnt = p => d.c[p.id] != null ? d.c[p.id] : p.q;
  const tot = S.pr.reduce((a, p) => a + (prVal(p.n, p.u, cnt(p)) || 0), 0), done = Object.keys(d.c).length;
  return back + `<div class=card><div class=row><b>Inventario del ${dm(d.d)}</b><span class=m>${done}/${S.pr.length} contati</span></div>${C ? `<div style="margin-top:4px">Valore stimato <b id=invt>${eur(tot)}</b></div>` : ''}<div class=m id=invn style="display:none"></div>
      <div class=row style="margin-top:8px;gap:6px"><input id=invq placeholder="Cerca prodotto" value="${esc(invQ)}" style="margin:0"><button class="g sm" data-a=invsc style="flex:none">Scansiona</button></div>
      <div class=hint>Scrivi la quantità contata: quelle che non tocchi restano come sono.</div></div>`
    + S.fr.map(f => {
      const R = L.filter(p => p.f == f.id);
      if (!R.length) return '';
      return `<div class=card><b>${esc(f.n)}</b>${R.map(p => `<div class=row style="margin-top:8px;gap:8px"><div style="flex:1;min-width:0"><div>${esc(p.n)}${p.pp ? ' <span class=m>(prep.)</span>' : ''}</div><div class=m style="font-size:12px">a sistema ${p.q} ${esc(p.u)}${C && prVal(p.n, p.u, 1) != null ? ' · ' + eur(prVal(p.n, p.u, cnt(p))) : ''}</div></div><input type=number step=any min=0 inputmode=decimal data-inv=${p.id} value="${d.c[p.id] != null ? d.c[p.id] : ''}" placeholder="${p.q}" style="width:90px;margin:0;${d.c[p.id] != null ? 'border-color:var(--g);font-weight:700' : ''}"><span class=m style="flex:none;width:44px">${esc(p.u)}</span></div>`).join('')}</div>`;
    }).join('')
    + `<div class=row style="margin-bottom:12px"><button class="g d" data-a=invx>Annulla</button><button data-a=invok>Conferma inventario</button></div>`;
}

function invConfirm() {
  const d = invDraft(); if (!d) return;
  const n = Object.keys(d.c).filter(id => S.pr.some(p => p.id == id)).length;
  if (!confirm(`Confermare l'inventario? ${n} quantità contate verranno aggiornate nel magazzino.`)) return;
  const r = [];
  let tot = 0, nv = 0;
  S.pr.forEach(p => {
    if (d.c[p.id] != null) p.q = +(+d.c[p.id]).toFixed(3);
    const val = prVal(p.n, p.u, p.q);
    if (val == null) nv++; else tot += val;
    r.push({n:p.n, u:p.u, q:p.q, v:val == null ? null : +val.toFixed(2), f:(S.fr.find(f => f.id == p.f) || {}).n || ''});
  });
  S.inv.push({id:uid(), d:d.d, by:me(), tot:+tot.toFixed(2), nv, r});
  invSave(null);
  act('inventario', `Inventario del ${dm(d.d)}: ${r.length} prodotti${can('cost') ? ' · ' + eur(tot) : ''}`);
  save(); draw(); tst('Inventario salvato');
}

function invDetail(id) {
  const x = S.inv.find(y => y.id == id); if (!x) return;
  const D = $('#d'), C = can('cost');
  D.innerHTML = `<div class=row><h3 style="margin:0">Inventario del ${dm(x.d)}</h3><button class=g data-a=gcl>Chiudi</button></div><div class=m>${esc(x.by || '')}${C ? ' · valore ' + eur(x.tot) : ''}</div>
    <table style="margin-top:8px"><tr><th>Prodotto</th><th>Dove</th><th>Qtà</th>${C ? '<th>Valore</th>' : ''}</tr>${x.r.map(r => `<tr><td>${esc(r.n)}</td><td class=m>${esc(r.f)}</td><td>${r.q} ${esc(r.u)}</td>${C ? `<td>${r.v == null ? '<span class=m>–</span>' : eur(r.v)}</td>` : ''}</tr>`).join('')}</table>
    <div class=row style="margin-top:12px"><button class="g d" type=button id=ivx>Elimina</button><button type=button id=ivs>Condividi</button></div>`;
  D.showModal();
  $('#ivs').onclick = () => shareText(`Inventario ${S.loc || ''} del ${dm(x.d)}${C ? ' — ' + eur(x.tot) : ''}\n` + x.r.map(r => `• ${r.n}: ${r.q} ${r.u}${C && r.v != null ? ' (' + eur(r.v) + ')' : ''}`).join('\n'));
  $('#ivx').onclick = () => { if (confirm('Eliminare questo inventario dallo storico?')) { S.inv = S.inv.filter(y => y.id != id); save(); D.close(); } };
}

document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset && t.dataset.inv) {
    const d = invDraft(); if (!d) return;
    if (t.value === '') delete d.c[t.dataset.inv]; else d.c[t.dataset.inv] = num(t.value);
    invSave(d);
    t.style.borderColor = t.value === '' ? '' : 'var(--g)'; t.style.fontWeight = t.value === '' ? '' : '700';
    const el = $('#invt');
    if (el) el.textContent = eur(S.pr.reduce((a, p) => a + (prVal(p.n, p.u, d.c[p.id] != null ? d.c[p.id] : p.q) || 0), 0));
  }
  if (t.id == 'invq') { invQ = t.value; clearTimeout(t._t); t._t = setTimeout(() => { const pos = t.selectionStart; draw(); const i = $('#invq'); if (i) { i.focus(); i.setSelectionRange(pos, pos); } }, 350); }
});

Object.assign(A, {
  xinv: () => { mgs = 'inv'; draw(); scrollTo(0, 0); },
  invs: () => invStart(),
  invx: () => { if (confirm('Annullare l\'inventario in corso? I conteggi fatti si perdono.')) { invSave(null); draw(); } },
  invok: () => invConfirm(),
  invd: id => invDetail(id),
  invsc: () => scanUI('Cerca nell\'inventario', (raw, ctl) => {
    const g = gs1(raw), key = bcKey(g && g.gtin ? g.gtin : raw), cat = S.bc.find(x => x.id == key);
    ctl.close();
    if (!cat) return tst('Codice non salvato: cerca il prodotto per nome');
    invQ = cat.n; draw();
    const i = document.querySelector('[data-inv]'); if (i) i.focus();
  })
});
