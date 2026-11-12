// Brigata — funzioni di base, stato e permessi
'use strict';

const AL = ['Glutine','Crostacei','Uova','Pesce','Arachidi','Soia','Latte','Frutta a guscio','Sedano','Senape','Sesamo','Solfiti','Lupini','Molluschi'];

const PRE = {
  'Ristorante': {u:[['Frigo cucina',0,4],['Frigo carni',0,4],['Frigo pesce',-1,2],['Freezer',-25,-18]], t:['Pulizia piani e taglieri','Sanificazione attrezzature','Pulizia pavimenti','Controllo scadenze e rotazione','Pulizia cappa e friggitrice']},
  'Bar': {u:[['Frigo latticini',0,4],['Banco frigo',0,4],['Freezer',-25,-18]], t:['Pulizia macchina caffè','Pulizia banco','Sanificazione frullatori','Controllo scadenze','Pulizia servizi']},
  'Pasticceria': {u:[['Frigo creme',0,4],['Vetrina refrigerata',0,4],['Freezer',-25,-18]], t:['Sanificazione piani e impastatrici','Pulizia forni','Controllo scadenze e lotti','Pulizia laboratorio','Controllo infestanti']},
  'Gastronomia': {u:[['Frigo',0,4],['Banco caldo',65,90],['Freezer',-25,-18]], t:['Sanificazione piani','Pulizia gastronorm e carrelli','Controllo scadenze','Etichettatura prodotti','Pulizia pavimenti']},
  'Hotel e mensa': {u:[['Frigo',0,4],['Freezer',-25,-18],['Buffet freddo',0,10],['Buffet caldo',60,90]], t:['Sanificazione cucina','Pulizia buffet','Controllo scadenze','Pulizia pavimenti','Campioni pasto']}
};

// ---------- Utilità ----------
const $ = s => document.querySelector(s);
const uid = () => Math.random().toString(36).slice(2, 9) + Math.random().toString(36).slice(2, 5);
const eur = n => (+n || 0).toLocaleString('it-IT', {style:'currency', currency:'EUR'});
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today = () => new Date().toLocaleDateString('sv');
const hm = () => new Date().toLocaleTimeString('it', {hour:'2-digit', minute:'2-digit'});
const days = d => Math.round((new Date(d + 'T12:00') - new Date(today() + 'T12:00')) / 864e5);
const WD = ['Dom','Lun','Mar','Mer','Gio','Ven','Sab'];
const wd = d => new Date(d + 'T12:00').getDay();
const fd = d => WD[wd(d)] + ' ' + d.slice(8) + '/' + d.slice(5, 7);
const dm = d => d.slice(8) + '/' + d.slice(5, 7);
const num = x => { const n = parseFloat(String(x ?? '').replace(',', '.')); return isNaN(n) ? 0 : n; };
const v = (d, n) => { const e = d.querySelector(`[name=${n}]`); return e ? e.value : ''; };
const tags = a => a.map(k => `<span class=tag>${AL[k]}</span>`).join('');
const ago = iso => { const s = (Date.now() - new Date(iso)) / 1000; return s < 60 ? 'adesso' : s < 3600 ? Math.floor(s / 60) + ' min fa' : s < 86400 ? Math.floor(s / 3600) + ' h fa' : new Date(iso).toLocaleDateString('it'); };

function tst(m) {
  document.querySelectorAll('.toast').forEach(x => x.remove());
  const d = document.createElement('div');
  d.className = 'toast'; d.textContent = m;
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 2200);
}

function shareText(t) {
  if (navigator.share) return navigator.share({text: t}).catch(() => {});
  if (navigator.clipboard) return navigator.clipboard.writeText(t).then(() => tst('Testo copiato'));
  window.open('https://wa.me/?text=' + encodeURIComponent(t));
}

function shareCanvas(c, name) {
  c.toBlob(b => {
    const f = new File([b], name, {type:'image/png'});
    if (navigator.canShare && navigator.canShare({files:[f]})) navigator.share({files:[f]}).catch(() => {});
    else { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; a.click(); }
  });
}

// ---------- Stato ----------
const ARR = ['ing','rec','u','t','log','lots','pren','fr','pr','sp','nt','tv','st','cl','sc','bc','att'];
let S = null;
let STORE = 'cp';          // chiave localStorage dei dati in uso ('cp' = solo su questo dispositivo)

function norm(x) {
  x = x && typeof x == 'object' ? x : {};
  ARR.forEach(k => { if (!Array.isArray(x[k])) x[k] = []; });
  if (!x.done || typeof x.done != 'object') x.done = {};
  if (!x.sh || typeof x.sh != 'object') x.sh = {};
  if (Array.isArray(x.cw)) { const o = {}; x.cw.forEach(w => o[w] = 'T'); x.cw = o; }
  if (!x.cw || typeof x.cw != 'object') x.cw = {};
  if (typeof x.loc != 'string') x.loc = '';
  // Versioni precedenti: magazzino e bacheca vecchi
  if (x.mag) {
    if (x.mag.f && x.mag.f.length && !x.fr.length) {
      x.mag.f.forEach(f => {
        x.fr.push({id:f.id, n:f.n, k:f.k, a:f.d == 2 ? 2 : 1, sh:f.k == 'cong' ? 1 : f.sh});
        (f.items || []).forEach(i => x.pr.push({id:i.id, n:i.n, q:i.q, u:i.u, f:f.id, s:(+i.sf || 0) + 1, l:'', e:i.e || ''}));
      });
    }
    if (x.mag.shop && x.mag.shop.length && !x.sp.length) x.mag.shop.forEach(i => x.sp.push({id:i.id, n:i.n, q:i.q || 1, u:i.u, ok:i.done ? 1 : 0}));
    delete x.mag;
  }
  if (x.bach) {
    x.bach.forEach(b => {
      if (b.t == 't' && !x.tv.some(t => t.id == b.id)) x.tv.push({id:b.id, n:b.g, d:b.d, p:+b.n || 1, pr:+b.p || 0, m:b.m || '', dl:b.s == 'c' ? 'cli' : 'casa', dd:'', nt:b.x || ''});
      if (b.t == 'n' && !x.nt.some(t => t.id == b.id)) x.nt.push({id:b.id, a:b.a, x:b.x, d:b.d, i:0});
    });
    delete x.bach;
  }
  if (x.nick && !x.me) x.me = x.nick;
  delete x.nick;
  x.log.forEach(l => { if (!l.id) l.id = uid(); });
  x.rec.forEach(r => { if (r.mn == null) r.mn = 1; if (!r.cat) r.cat = ''; });
  return x;
}

function load(key) {
  STORE = key;
  let x = null;
  try { x = JSON.parse(localStorage.getItem(key)); } catch (e) {}
  S = norm(x);
}

let saveHook = null;   // impostato dal modulo cloud
function save() {
  try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) { tst('Memoria del telefono piena: esporta un backup.'); }
  if (saveHook) saveHook();
}

// ---------- Permessi ----------
// owner = titolare, manager = responsabile/sous chef, cook = cuoco
const ROLES = {owner:'Titolare', manager:'Responsabile', cook:'Cuoco'};
const PERM = {
  cost: ['owner','manager'],     // prezzi, food cost, margini
  edit: ['owner','manager'],     // ricette, ingredienti, zone, unità, turni, impostazioni locale
  invite: ['owner','manager'],   // codici invito
  team: ['owner']                // ruoli e rimozione membri
};
const role = () => (typeof Cloud != 'undefined' && Cloud.rid) ? (Cloud.role || 'cook') : 'owner';
const can = p => PERM[p].includes(role());
const me = () => (typeof Cloud != 'undefined' && Cloud.rid && Cloud.name) || S.me || '';
function act(kind, text) { if (typeof Cloud != 'undefined' && Cloud.rid) Cloud.act(kind, text); }

// ---------- Finestre di modifica ----------
// ed(titolo, html, onSave) — onSave restituisce false per non chiudere
function ed(t, h, ok, extra) {
  const d = $('#d');
  d.innerHTML = `<h3 style="margin-top:0">${t}</h3>${h}<div class=row style="margin-top:12px">${extra || ''}<button class=g type=button id=x>Annulla</button><button type=button id=s>Salva</button></div>`;
  if (!d.open) d.showModal();
  $('#x').onclick = () => d.close();
  $('#s').onclick = () => { if (ok(d) !== false) { d.close(); save(); draw(); } };
}

const A = {};   // azioni: data-a="nome" → A.nome(id, el)

// ---------- Icone ----------
const sv = p => `<svg viewBox="0 0 24 24" width=22 height=22 fill=none stroke=currentColor stroke-width=1.8 stroke-linecap=round stroke-linejoin=round>${p}</svg>`;
const IC = {
  pro: sv('<path d="M4 9l1-5h14l1 5"/><path d="M4 9a3 3 0 0 0 5 0 3 3 0 0 0 6 0 3 3 0 0 0 5 0"/><path d="M5 12v8h14v-8"/>'),
  pre: sv('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M9 15l2 2 4-4"/>'),
  cuc: sv('<path d="M7 14v6h10v-6"/><path d="M7 14a4 4 0 0 1-1-7.7A4 4 0 0 1 12 4a4 4 0 0 1 6 2.3A4 4 0 0 1 17 14z"/>'),
  mag: sv('<rect x="6" y="3" width="12" height="18" rx="2"/><path d="M6 10h12M9 6v2M9 13v3"/>'),
  bac: sv('<path d="M5 4h14v12l-4 4H5z"/><path d="M15 20v-4h4M8 9h8M8 13h5"/>'),
  tur: sv('<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>'),
  hac: sv('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M8.5 12l2.5 2.5 5-5"/>'),
  stf: sv('<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><circle cx="17" cy="9" r="2.3"/><path d="M15.5 14.2A5 5 0 0 1 21 19"/>')
};
const LOGO = `<svg viewBox="0 0 32 32" width=36 height=36><path d="M11 4 6 7l-4 7 5 3 2-3v14h14V14l2 3 5-3-4-7-5-3-5 7z" fill="#14120e"/><path d="M11 4l5 7 5-7M16 11v17" fill=none stroke="#c9a24a" stroke-width=1.2 stroke-linejoin=round /><g fill="#c9a24a"><circle cx=13.2 cy=17 r=1.1 /><circle cx=13.2 cy=21 r=1.1 /><circle cx=13.2 cy=25 r=1.1 /><circle cx=18.8 cy=17 r=1.1 /><circle cx=18.8 cy=21 r=1.1 /><circle cx=18.8 cy=25 r=1.1 /></g></svg>`;
