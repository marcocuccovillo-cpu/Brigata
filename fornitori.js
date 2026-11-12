// Brigata — fornitori, ordine merci diviso per fornitore, scorte minime e ordine automatico
'use strict';

const GGN = ['Dom','Lun','Mar','Mer','Gio','Ven','Sab'];
const pKey = n => String(n || '').trim().toLowerCase();
const psOf = n => S.ps.find(x => x.id == pKey(n));
const foById = id => S.fo.find(x => x.id == id);

// fornitore di un prodotto: scelto sulla riga, poi scheda prodotto, poi fornitore scritto sull'ingrediente
function foFor(name, line) {
  if (line && line.fo && foById(line.fo)) return line.fo;
  const ps = psOf(name); if (ps && ps.fo && foById(ps.fo)) return ps.fo;
  const i = S.ing.find(x => pKey(x.n) == pKey(name));
  if (i && i.f) { const f = S.fo.find(x => pKey(x.n) == pKey(i.f)); if (f) return f.id; }
  return '';
}
const nextDelivery = f => {
  if (!f || !f.gg || !f.gg.length) return '';
  for (let k = 0; k < 7; k++) { const d = trD(today(), k); if (f.gg.includes(wd(d))) return k == 0 ? 'oggi' : k == 1 ? 'domani' : GGN[wd(d)].toLowerCase() + ' ' + dm(d); }
  return '';
};
const waNum = t => { let d = String(t || '').replace(/[^\d+]/g, '').replace(/^\+/, '').replace(/^00/, ''); if (/^3\d{8,9}$/.test(d) || /^0\d{5,10}$/.test(d)) d = '39' + d; return d; };

function addOrder(n, q, u, fo) {
  const e = S.sp.find(x => !x.ok && pKey(x.n) == pKey(n) && x.u == u);
  if (e) { e.q = +(e.q + q).toFixed(2); return e; }
  const x = {id:uid(), n, q:+q.toFixed(2), u, ok:0, fo:fo || foFor(n)};
  S.sp.push(x);
  return x;
}

// ---------- scorte minime ----------
const stockOf = (n, u) => +S.pr.filter(x => !x.pp && pKey(x.n) == pKey(n) && x.u == u).reduce((a, x) => a + (+x.q || 0), 0).toFixed(3);
const prepStock = (n, u) => +S.pr.filter(x => x.pp && pKey(x.n) == pKey(n) && x.u == u).reduce((a, x) => a + (+x.q || 0), 0).toFixed(3);
const lowStock = () => S.ps.filter(p => p.min > 0 && stockOf(p.n, p.u) < p.min);
const prepTodo = () => S.pp.filter(p => p.mn > 0 && prepStock(p.n, p.u) < p.mn);

// chiamata a ogni salvataggio: quando un prodotto scende sotto il minimo finisce una volta sola nell'ordine
function autoOrder() {
  if (!S.ps || !S.ps.length) return;
  S.ps.forEach(p => {
    if (!(p.min > 0)) { if (p.low) delete p.low; return; }
    const tot = stockOf(p.n, p.u), low = tot < p.min;
    if (low && !p.low) {
      p.low = 1;
      if (!S.sp.some(x => !x.ok && pKey(x.n) == p.id)) {
        addOrder(p.n, p.o > 0 ? p.o : +(p.min - tot).toFixed(2), p.u, p.fo);
        setTimeout(() => tst(`${p.n} sotto scorta: aggiunto all'ordine`), 50);
      }
    } else if (!low && p.low) delete p.low;
  });
}

// scheda prodotto: minimo, quantità da riordinare, fornitore
function psFields(n, u) {
  const p = psOf(n) || {};
  return `<div class=m style="margin-top:10px">Scorta e fornitore</div>
    <div class=row><input name=psmin type=number step=any min=0 inputmode=decimal placeholder="Scorta minima" value="${p.min || ''}"><input name=pso type=number step=any min=0 inputmode=decimal placeholder="Quanto riordinare" value="${p.o || ''}"></div>
    <select name=psfo><option value="">Fornitore…</option>${S.fo.map(f => `<option value=${f.id} ${f.id == p.fo ? 'selected' : ''}>${esc(f.n)}</option>`).join('')}</select>
    <div class=hint>Sotto la scorta minima (nella stessa unità) il prodotto va da solo nell'ordine merci.</div>`;
}
function psSave(d, n, u) {
  if (!n) return;
  const min = num(v(d, 'psmin')), o = num(v(d, 'pso')), fo = v(d, 'psfo');
  let p = psOf(n);
  if (!p && !min && !fo) return;
  if (!p) { p = {id:pKey(n), n}; S.ps.push(p); }
  Object.assign(p, {n, u, min, o, fo});
}

// ---------- fornitori ----------
function eFo(id) {
  const n = !id, f = foById(id) || {id:uid(), n:'', tel:'', em:'', gg:[], x:''};
  ed(n ? 'Nuovo fornitore' : 'Fornitore',
    `<input name=n placeholder="Nome (es. Ortofrutta Rossi)" value="${esc(f.n)}">
     <input name=tel type=tel inputmode=tel placeholder="WhatsApp / telefono" value="${esc(f.tel)}">
     <input name=em type=email placeholder="Email (facoltativa)" value="${esc(f.em)}">
     <div class=m style="margin-top:6px">Giorni di consegna</div>
     <div id=fogg>${[1,2,3,4,5,6,0].map(g => `<label class=chk><input type=checkbox value=${g} ${f.gg.includes(g) ? 'checked' : ''}>${GGN[g]}</label>`).join('')}</div>
     <input name=x placeholder="Note (orari, minimo d'ordine, agente…)" value="${esc(f.x)}">`,
    d => {
      if (!v(d, 'n').trim()) return false;
      Object.assign(f, {n:v(d, 'n').trim(), tel:v(d, 'tel').trim(), em:v(d, 'em').trim(), x:v(d, 'x').trim(), gg:[...d.querySelectorAll('#fogg input:checked')].map(c => +c.value)});
      if (n) S.fo.push(f);
    }, n ? '' : `<button type=button class="g d" id=fox>Elimina</button>`);
  if (!n) $('#fox').onclick = () => { if (confirm('Eliminare ' + f.n + '?')) { S.fo = S.fo.filter(x => x.id != f.id); save(); $('#d').close(); } };
}

function vFo() {
  const E = can('edit');
  return `<button class=g data-a=xmb style="margin-bottom:10px">‹ Magazzino</button>${E ? '<button data-a=fon class=w style="margin-bottom:10px">+ Fornitore</button>' : ''}`
    + (S.fo.map(f => `<div class=card ${E ? `data-a=foe data-id=${f.id} style="cursor:pointer"` : ''}><div class=row><b>${esc(f.n)}</b><span class=m>${f.gg && f.gg.length ? 'consegna ' + [1,2,3,4,5,6,0].filter(g => f.gg.includes(g)).map(g => GGN[g].toLowerCase()).join(', ') : ''}</span></div>${f.tel ? `<div class=m>${esc(f.tel)}</div>` : ''}${f.x ? `<div class=m style="font-size:12px">${esc(f.x)}</div>` : ''}${nextDelivery(f) ? `<div class=hint>Prossima consegna: ${nextDelivery(f)}</div>` : ''}</div>`).join('')
      || `<div class=empty>${E ? 'Aggiungi i fornitori: l\'ordine merci si divide da solo per fornitore e parte su WhatsApp a ciascuno.' : 'Nessun fornitore inserito.'}</div>`);
}

// ---------- ordine merci ----------
function mgSpE(id) {
  const n = !id, x = S.sp.find(y => y.id == id) || {n:'', q:1, u:'kg', fo:''};
  ed(n ? 'Aggiungi all\'ordine' : 'Riga dell\'ordine',
    `<input name=n list=dl2 placeholder="Prodotto" value="${esc(x.n)}"><datalist id=dl2>${[...new Set([...S.ing.map(i => i.n), ...S.pr.filter(p => !p.pp).map(p => p.n), ...S.ps.map(p => p.n)])].map(t => `<option value="${esc(t)}">`).join('')}</datalist>
     <div class=row><input name=q type=number step=any min=0 inputmode=decimal value="${x.q}"><select name=u>${[...new Set([...MGU, x.u])].map(u => `<option ${u == x.u ? 'selected' : ''}>${esc(u)}</option>`).join('')}</select></div>
     <input name=uc placeholder="Altra unità (facoltativa)">
     <select name=fo><option value="">Fornitore…</option>${S.fo.map(f => `<option value=${f.id} ${f.id == (x.fo || '') ? 'selected' : ''}>${esc(f.n)}</option>`).join('')}</select>`,
    d => {
      const nm = v(d, 'n').trim(); if (!nm) return false;
      const u = v(d, 'uc').trim() || v(d, 'u'), q = num(v(d, 'q')) || 1, fo = v(d, 'fo');
      if (n) addOrder(nm, q, u, fo); else Object.assign(x, {n:nm, q, u, fo});
      if (fo) { const p = psOf(nm); if (p) p.fo = fo; else S.ps.push({id:pKey(nm), n:nm, u, min:0, o:0, fo}); }
    }, n ? '' : `<button type=button class="g d" id=spx>Elimina</button>`);
  const D = $('#d');
  if (n) D.querySelector('[name=n]').oninput = e => { const f = foFor(e.target.value); if (f) D.querySelector('[name=fo]').value = f; const p = psOf(e.target.value); if (p && p.u) D.querySelector('[name=u]').value = p.u; };
  else $('#spx').onclick = () => { S.sp = S.sp.filter(y => y.id != id); save(); D.close(); };
}

const spGroups = () => {
  const G = {};
  S.sp.forEach(x => { const k = foFor(x.n, x); (G[k] = G[k] || []).push(x); });
  return Object.keys(G).sort((a, b) => (a ? 0 : 1) - (b ? 0 : 1) || (foById(a) || {n:''}).n.localeCompare((foById(b) || {n:''}).n)).map(k => ({f:foById(k), L:G[k]}));
};
const spTxt = (L, f) => 'Ordine' + (S.loc ? ' ' + S.loc : '') + (f ? ' per ' + f.n : '') + ' — ' + new Date().toLocaleDateString('it') + '\n' + L.filter(x => !x.ok).map(x => '• ' + x.n + ' — ' + x.q + ' ' + x.u).join('\n');

function spImg(L, f) {
  L = L.filter(x => !x.ok);
  const c = document.createElement('canvas'), W = 720, H = 150 + L.length * 56 + 40;
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#faf6ec'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#14120e'; g.fillRect(0, 0, W, 90);
  g.fillStyle = '#c9a24a'; g.font = 'bold 34px Georgia'; g.fillText(f ? 'Ordine · ' + f.n : 'Ordine merci', 30, 58);
  g.font = '28px system-ui';
  L.forEach((x, i) => { g.strokeStyle = '#14120e'; g.lineWidth = 2; g.strokeRect(30, 128 + i * 56, 26, 26); g.fillStyle = '#14120e'; g.fillText(x.n + '  —  ' + x.q + ' ' + x.u, 74, 152 + i * 56); });
  g.fillStyle = '#6f6753'; g.font = '20px system-ui'; g.fillText((S.loc || 'Brigata') + ' · ' + new Date().toLocaleDateString('it'), 30, H - 16);
  shareCanvas(c, 'ordine.png');
}

function mgSp() {
  const line = x => `<div class=li><div class=row><label class=chk style="margin:0;min-width:0"><input type=checkbox data-a=xsk data-id=${x.id} ${x.ok ? 'checked' : ''}><span style="${x.ok ? 'text-decoration:line-through;color:var(--m)' : ''}">${esc(x.n)}</span></label><button class="g sm" data-a=xsE data-id=${x.id}>Modifica</button></div><div class="row st" style="margin-top:6px;gap:8px"><button class=g data-a=xsq data-id=${x.id} data-d=-1 style="width:44px">−</button><b style="min-width:72px;text-align:center;font-size:17px">${x.q} <span class=m>${esc(x.u)}</span></b><button class=g data-a=xsq data-id=${x.id} data-d=1 style="width:44px">+</button></div></div>`;
  const G = spGroups(), low = lowStock().filter(p => !S.sp.some(x => !x.ok && pKey(x.n) == p.id));
  return `<button class=g data-a=xmb style="margin-bottom:10px">‹ Magazzino</button>`
    + `<div class="row st" style="margin-bottom:10px"><button data-a=xsa>+ Aggiungi</button>${S.sp.length ? '<button class=g data-a=xar>Ordine arrivato</button>' : ''}<button class=g data-a=fol>Fornitori${S.fo.length ? ` (${S.fo.length})` : ''}</button></div>`
    + (low.length ? `<div class=card style="border-color:var(--g)"><b>Sotto scorta, non ancora nell'ordine</b>${low.map(p => `<div class=row style="margin-top:6px"><span>${esc(p.n)} <span class=m>${stockOf(p.n, p.u)} / ${p.min} ${esc(p.u)}</span></span><button class="g sm" data-a=spl data-id="${esc(p.id)}">Ordina</button></div>`).join('')}</div>` : '')
    + (G.map(({f, L}) => {
      const open = L.filter(x => !x.ok).length, nd = nextDelivery(f);
      return `<div class=card><div class=row><div><b>${f ? esc(f.n) : 'Senza fornitore'}</b>${nd ? `<div class=m style="font-size:12px">prossima consegna ${nd}</div>` : ''}</div><span class=m>${open} da ordinare</span></div>`
        + L.map(line).join('')
        + (open ? `<div class="row st" style="margin-top:10px">${f && f.tel ? `<button class=sm data-a=spw data-id="${f ? f.id : ''}">WhatsApp a ${esc(f.n)}</button>` : ''}<button class="g sm" data-a=spt data-id="${f ? f.id : ''}">Testo</button><button class="g sm" data-a=spi data-id="${f ? f.id : ''}">Immagine</button></div>` : '')
        + `</div>`;
    }).join('') || '<div class=card><div class=m>Ordine vuoto: dal magazzino tocca "Ordina" su un prodotto, oppure imposta le scorte minime e i prodotti arrivano qui da soli.</div></div>')
    + (S.sp.some(x => x.ok) ? '<button class=g data-a=xsc style="margin-bottom:10px">Rimuovi gli ordinati</button>' : '')
    + `<div class=m>Spunta ciò che hai già ordinato. Con "WhatsApp" l'ordine di quel fornitore parte già scritto al suo numero.</div>`;
}

const grpOf = id => { const g = spGroups().find(x => (x.f ? x.f.id : '') == (id || '')); return g || {f:null, L:[]}; };

Object.assign(A, {
  xsa: () => mgSpE(), xsE: id => mgSpE(id),
  xsq: (id, el) => { const x = S.sp.find(y => y.id == id), st = ['g','ml'].includes(x.u) ? 100 : 1; x.q = Math.max(0, +(x.q + st * +el.dataset.d).toFixed(2)); save(); draw(); },
  xsk: (id, el) => { S.sp.find(x => x.id == id).ok = el.checked ? 1 : 0; save(); draw(); },
  xsc: () => { S.sp = S.sp.filter(x => !x.ok); save(); draw(); },
  spt: id => { const g = grpOf(id); shareText(spTxt(g.L, g.f)); },
  spi: id => { const g = grpOf(id); spImg(g.L, g.f); },
  spw: id => {
    const g = grpOf(id), t = spTxt(g.L, g.f);
    window.open('https://wa.me/' + waNum(g.f.tel) + '?text=' + encodeURIComponent(t), '_blank');
    if (confirm('Segnare come ordinati i prodotti mandati a ' + g.f.n + '?')) { g.L.forEach(x => x.ok = 1); act('ordine', `Ordine inviato a ${g.f.n}: ${g.L.length} prodotti`); save(); draw(); }
  },
  spl: id => { const p = S.ps.find(x => x.id == id); if (!p) return; addOrder(p.n, p.o > 0 ? p.o : Math.max(1, +(p.min - stockOf(p.n, p.u)).toFixed(2)), p.u, p.fo); save(); draw(); },
  fol: () => { mgs = 'fornitori'; draw(); scrollTo(0, 0); }, fon: () => eFo(), foe: id => eFo(id)
});
