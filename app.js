// Brigata — navigazione, disegno delle pagine e avvio
'use strict';

const T = {
  pro: ['Profilo', vF, 'Il tuo locale'],
  pre: ['Libro', vP, 'Libro prenotazioni'],
  cuc: ['Cucina', vCuc],
  mag: ['Magazzino', vMag],
  bac: ['Bacheca', vBac],
  tur: ['Turni', vTur, 'Turni di lavoro'],
  hac: ['HACCP', vH],
  rep: ['Report', vRep, 'Report del mese'],
  stf: ['Staff', vStf, 'Staff e account']
};
let tab = 'pro', pendingDraw = false;

function hdr() {
  $('header').innerHTML = LOGO + `<div class=bn>Brigata${S.loc ? `<small>${esc(S.loc)}</small>` : ''}</div><span id=sync class=sync data-a=tab data-id=stf style="display:none"></span>` + (S.logo ? `<img class=hlogo src="${S.logo}" alt="">` : '');
  badge();
}

function draw() {
  pendingDraw = false;
  if (!T[tab]) tab = 'pro';
  hdr();
  $('main').innerHTML = `<h1 class=pt>${T[tab][2] || T[tab][0]}</h1>` + T[tab][1]();
  const hs = $('#hs'); if (hs) hs.scrollLeft = hs.scrollWidth;
  document.querySelectorAll('canvas[data-qr]').forEach(c => drawQR(c, c.dataset.qr));
  if (tab == 'rep' && !can('edit')) tab = 'pro';
  $('nav').innerHTML = Object.entries(T).filter(([k]) => k != 'rep' || can('edit')).map(([k, [n]]) => `<button data-a=tab data-id=${k} class="${k == tab ? 'on' : ''}"><span class=ic>${IC[k]}</span><span class=lb>${n}</span></button>`).join('');
  const o = $('nav .on'); if (o) $('nav').scrollTop = o.offsetTop - ($('nav').clientHeight - o.offsetHeight) / 2;
}

// ridisegna dopo una sincronizzazione senza disturbare chi sta scrivendo
function refresh() {
  const a = document.activeElement;
  if ($('#d').open || (a && a.closest && a.closest('main') && /INPUT|TEXTAREA|SELECT/.test(a.tagName))) { pendingDraw = true; hdr(); return; }
  draw();
}
document.addEventListener('focusout', () => setTimeout(() => { if (pendingDraw) refresh(); }, 200));

function go(id) {
  if (['rec','ing','men','sca'].includes(id)) { sub = id; tab = 'cuc'; } else tab = id;
  if (id == 'mag') mgs = null;
  if (id == 'att') { tab = 'tur'; trV = 'att'; }
  if (id == 'man') { tab = 'hac'; hS = 'man'; }
  if (id == 'hac') hS = 'oggi';
  draw(); scrollTo(0, 0);
}

function del(k, id) {
  if (!confirm('Eliminare?')) return;
  S[k] = S[k].filter(x => x.id != id);
  save(); draw();
}

Object.assign(A, {
  tab: id => go(id),
  gcl: () => $('#d').close(),
  print: () => window.print()
});

document.addEventListener('click', e => {
  const el = e.target.closest('[data-a]');
  if (!el) return;
  const f = A[el.dataset.a];
  if (f) f(el.dataset.id, el, e);
});

$('#d').addEventListener('close', () => draw());

Cloud.boot();
draw();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
