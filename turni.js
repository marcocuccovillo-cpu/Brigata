// Brigata — Turni di lavoro e chiusure
'use strict';

const TRN = ['dom','lun','mar','mer','gio','ven','sab'];
const TRC = [['P','Pranzo'],['C','Cena'],['D','Doppio'],['R','Riposo'],['F','Ferie']];
const trD = (k, n) => { const d = new Date(k + 'T12:00'); d.setDate(d.getDate() + n); return d.toLocaleDateString('sv'); };
const trMon = k => { const d = new Date(k + 'T12:00'); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return d.toLocaleDateString('sv'); };
const trF = k => TRN[new Date(k + 'T12:00').getDay()] + ' ' + dm(k);
const trR = k => k.slice(8) + '/' + k.slice(5, 7) + '/' + k.slice(2, 4);
const trSvc = k => { const v = S.cw[new Date(k + 'T12:00').getDay()] || '', per = S.cl.some(c => k >= c.a && k <= c.b); return {p:per || v == 'P' || v == 'T', c:per || v == 'C' || v == 'T'}; };
const trClosed = k => { const x = trSvc(k); return x.p && x.c; };
let trW = trMon(today()), trSc = 'all', trV = 'gr';

// ---------- Persone dei turni = account della brigata ----------
// Con l'account del ristorante le persone dei turni sono i membri (titolare, responsabili, cuochi):
// si aggiungono da sole quando qualcuno entra con un codice invito. Senza account si inseriscono a mano.
const stTeam = () => !!Cloud.rid;
const stVis = ks => S.st.filter(p => !p.ex || (ks || []).some(k => trSh(k)[p.id]));
function stRelink(oldId, newId) {   // sposta i turni di una persona inserita a mano sul suo account
  for (const k in S.sh) if (S.sh[k][oldId] != null) { S.sh[k][newId] = S.sh[k][oldId]; delete S.sh[k][oldId]; }
  if (S.tpl && S.tpl.d) for (const i in S.tpl.d) if (S.tpl.d[i][oldId] != null) { S.tpl.d[i][newId] = S.tpl.d[i][oldId]; delete S.tpl.d[i][oldId]; }
}
function stFromTeam() {
  if (!Cloud.rid || !can('edit') || !Cloud.members) return false;
  const M = Cloud.members, low = s => String(s || '').trim().toLowerCase();
  let ch = false;
  // persone inserite a mano con lo stesso nome di un account: si collegano da sole
  S.st.filter(p => !p.u).forEach(p => {
    const m = M.find(x => x.name && low(x.name) == low(p.n) && !S.st.some(q => q.id == x.user_id));
    if (m) { stRelink(p.id, m.user_id); S.st = S.st.filter(x => x != p); ch = true; }
  });
  M.forEach(m => {
    const n = m.name || 'Senza nome', r = ROLES[m.role], p = S.st.find(x => x.id == m.user_id);
    if (!p) { S.st.push({id:m.user_id, n, r, u:1}); ch = true; }
    else if (p.n != n || p.r != r || !p.u || p.ex) { Object.assign(p, {n, r, u:1}); delete p.ex; ch = true; }
  });
  S.st.forEach(p => { if (p.u && !p.ex && !M.some(m => m.user_id == p.id)) { p.ex = 1; ch = true; } });   // uscito dalla brigata
  return ch;
}
function stLink(id) {   // collega a mano una persona senza account
  const p = S.st.find(x => x.id == id); if (!p) return;
  const D = $('#d');
  D.innerHTML = `<h3 style="margin:0 0 6px">${esc(p.n)}</h3><div class=m>Questa persona è stata inserita a mano. Collegala al suo account per tenere i suoi turni, oppure eliminala.</div>
    <select id=lk style="margin-top:10px">${(Cloud.members || []).map(m => `<option value=${m.user_id}>${esc(m.name || 'Senza nome')} · ${ROLES[m.role]}</option>`).join('')}</select>
    <div class=row style="margin-top:12px"><button type=button class="g d" id=lkx>Elimina</button><button type=button class=g id=dc>Annulla</button><button type=button id=lkok ${(Cloud.members || []).length ? '' : 'disabled'}>Collega</button></div>`;
  D.showModal();
  $('#dc').onclick = () => D.close();
  $('#lkok').onclick = () => {
    const uid2 = $('#lk').value, m = Cloud.members.find(x => x.user_id == uid2);
    stRelink(p.id, uid2);
    S.st = S.st.filter(x => x != p);
    if (!S.st.some(x => x.id == uid2)) S.st.push({id:uid2, n:m.name || p.n, r:ROLES[m.role], u:1});
    save(); D.close(); tst('Turni collegati a ' + (m.name || p.n));
  };
  $('#lkx').onclick = () => {
    if (!confirm('Eliminare ' + p.n + ' e i suoi turni?')) return;
    S.st = S.st.filter(x => x.id != id);
    for (const k in S.sh) delete S.sh[k][id];
    if (S.tpl) for (const i in S.tpl.d) delete S.tpl.d[i][id];
    save(); D.close();
  };
}

// piano fisso bisettimanale: indice 0-13 del giorno nel ciclo
const trDi = k => ((Math.round((new Date(k + 'T12:00') - new Date(S.tpl.a + 'T12:00')) / 864e5) % 14) + 14) % 14;
const trSh = k => {
  const t = S.tpl;
  if (!t || !t.on) return S.sh[k] || {};
  const o = {...(t.d[trDi(k)] || {}), ...(S.sh[k] || {})};
  for (const x in o) if (!o[x]) delete o[x];
  return o;
};
const trSet = (k, pid, val) => {
  const t = S.tpl, fx = t && t.on;
  if (fx && trSc == 'all') {
    const i = trDi(k), m = t.d[i] = t.d[i] || {};
    if (val) m[pid] = val; else delete m[pid];
    if (S.sh[k]) delete S.sh[k][pid];
  } else {
    const m = S.sh[k] = S.sh[k] || {};
    if (val) m[pid] = val; else if (fx) m[pid] = ''; else delete m[pid];
    if (fx && (t.d[trDi(k)] || {})[pid] == (m[pid] || undefined)) delete m[pid];
  }
};
const trScope = () => S.tpl && S.tpl.on ? `<div class=sg style="margin-bottom:10px"><button type=button data-sc=all class="${trSc == 'all' ? 'on' : ''}">Sempre</button><button type=button data-sc=one class="${trSc == 'one' ? 'on' : ''}">Solo questa data</button></div>` : '';
const trWireScope = (D, paint) => D.querySelectorAll('[data-sc]').forEach(b => b.onclick = () => { trSc = b.dataset.sc; paint(); });

const trLockCard = () => {
  const t = S.tpl;
  return t && t.on
    ? `<div class=card style="padding:10px 12px;border-color:var(--g)"><div class=row><div><b>Piano fisso attivo</b><div class=m style="font-size:12px">Le due settimane si ripetono nel tempo finché non le modifichi.</div></div><button class="g sm" data-a=ysb>Sblocca</button></div></div>`
    : `<div class=card style="padding:10px 12px"><b>Piano fisso</b><div class=m style="font-size:12px">Blocca le due settimane mostrate: si ripeteranno ogni due settimane finché non le modifichi.</div><button class=sm data-a=ysl style="margin-top:8px">Blocca questo piano</button></div>`;
};

function trPick(pid, k) {
  const p = S.st.find(x => x.id == pid), D = $('#d'), sv = trSvc(k), bad = c => (c == 'P' && sv.p) || (c == 'C' && sv.c) || (c == 'D' && (sv.p || sv.c));
  trSc = 'all';
  const paint = () => {
    const cur = trSh(k)[pid] || '';
    D.innerHTML = `<h3 style="margin:0 0 10px">${esc(p.n)} · ${trF(k)}</h3>${trScope()}${sv.p || sv.c ? `<div class=m style="margin-bottom:8px">${sv.p ? 'Pranzo chiuso' : 'Cena chiusa'}: i turni che lo includono non sono disponibili.</div>` : ''}<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${TRC.map(([c, l]) => `<button type=button class="${cur == c ? '' : 'g'}" data-c=${c}${bad(c) ? ' disabled' : ''}>${c} · ${l}</button>`).join('')}</div><div class=row style="margin-top:12px"><button class="g d" type=button data-c=x>Svuota</button><button class=g type=button id=dc>Chiudi</button></div>`;
    D.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { const c = b.dataset.c; trSet(k, pid, c == 'x' ? '' : c); save(); D.close(); });
    trWireScope(D, paint);
    $('#dc').onclick = () => D.close();
  };
  paint(); D.showModal();
}

function trSt(id) {
  const n = !id, p = S.st.find(x => x.id == id) || {id:uid(), n:'', r:''}, D = $('#d');
  D.innerHTML = `<h3 style="margin:0 0 8px">${n ? 'Nuova persona' : 'Persona'}</h3><input name=n placeholder="Nome" value="${esc(p.n)}"><input name=r placeholder="Ruolo (es. Chef, Sous chef, Commis)" value="${esc(p.r)}"><div class=row style="margin-top:12px">${n ? '' : '<button class="g d" type=button id=dx>Elimina</button>'}<button class=g type=button id=dc>Annulla</button><button type=button id=ds>Salva</button></div>`;
  D.showModal();
  $('#dc').onclick = () => D.close();
  $('#ds').onclick = () => { const nm = v(D, 'n').trim(); if (!nm) return; Object.assign(p, {n:nm, r:v(D, 'r').trim()}); if (n) S.st.push(p); save(); D.close(); };
  if (!n) $('#dx').onclick = () => {
    if (!confirm('Eliminare ' + p.n + ' e i suoi turni?')) return;
    S.st = S.st.filter(x => x.id != id);
    for (const k in S.sh) delete S.sh[k][id];
    if (S.tpl) for (const i in S.tpl.d) delete S.tpl.d[i][id];
    save(); D.close();
  };
}

const trCl = () => ed('Periodo di chiusura', `<div class=m>Dal</div><input name=a type=date value="${today()}"><div class=m>Al (incluso)</div><input name=b type=date value="${today()}"><input name=n placeholder="Motivo (ferie estive, lavori…)">`, d => {
  const a = v(d, 'a'), b = v(d, 'b');
  if (!a || !b || b < a) { alert('Controlla le date.'); return false; }
  S.cl.push({id:uid(), a, b, n:v(d, 'n').trim()});
  act('turni', `Chiusura ${trR(a)}${a != b ? ' – ' + trR(b) : ''}${v(d, 'n').trim() ? ' (' + v(d, 'n').trim() + ')' : ''}`);
});

function trCopy(m) {
  const ds = [...Array(7)].map((_, i) => trD(m, i));
  if (ds.some(k => Object.keys(trSh(k)).length) && !confirm('Sostituire i turni di questa settimana con quelli della precedente?')) return;
  ds.forEach(k => {
    if (trClosed(k)) return;
    const src = S.sh[trD(k, -7)];
    if (src && Object.keys(src).length) S.sh[k] = {...src}; else delete S.sh[k];
  });
  save(); draw(); tst('Turni copiati dalla settimana precedente');
}

function trDay(k) {
  if (!can('edit')) return;
  const D = $('#d'), sv = trSvc(k);
  const tg = (c, s) => { if (s == 'R' || s == 'F') return c == s ? '' : s; let P = c == 'P' || c == 'D', C = c == 'C' || c == 'D'; if (s == 'P') P = !P; else C = !C; return P && C ? 'D' : P ? 'P' : C ? 'C' : ''; };
  trSc = 'all';
  const paint = () => {
    const o = trSh(k);
    D.innerHTML = `<h3 style="margin:0 0 4px">${trF(k)}</h3>${trScope()}${sv.p || sv.c ? `<div class=m style="margin-bottom:6px">${sv.p && sv.c ? 'Chiuso tutto il giorno' : sv.p ? 'Pranzo chiuso' : 'Cena chiusa'}</div>` : ''}`
      + (S.st.filter(p => !p.ex || o[p.id]).map(p => {
        const c = o[p.id] || '', has = s => c == s || c == 'D' && (s == 'P' || s == 'C');
        return `<div class=li><div class=row style="margin-bottom:6px"><b>${esc(p.n)}</b><span class=m>${esc(p.r)}</span></div><div class=row style="gap:4px">${[['P','Pranzo'],['C','Cena'],['R','Riposo'],['F','Ferie']].map(([s, l]) => `<button type=button data-p=${p.id} data-s=${s} class="${has(s) ? '' : 'g'}"${(s == 'P' && sv.p || s == 'C' && sv.c) && !has(s) ? ' disabled' : ''} style="flex:1;padding:8px 2px;font-size:13px">${l}</button>`).join('')}</div></div>`;
      }).join('') || '<div class=m>Aggiungi prima le persone.</div>')
      + `<button type=button id=dc class=w style="margin-top:12px">Fatto</button>`;
    D.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { trSet(k, b.dataset.p, tg(trSh(k)[b.dataset.p] || '', b.dataset.s)); save(); paint(); });
    trWireScope(D, paint);
    $('#dc').onclick = () => D.close();
  };
  paint(); D.showModal();
}

function grWeek(m) {
  const D = today(), ds = [...Array(7)].map((_, i) => trD(m, i)), sv = ds.map(trSvc), E = can('edit');
  const PL = stVis(ds);
  const anyOff = ds.some(k => PL.some(p => ['R','F'].includes(trSh(k)[p.id])));
  const hd = ds.map((k, i) => `<div class="gr-th${k == D ? ' tdy' : ''}${sv[i].p && sv[i].c ? ' off' : ''}${S.tpl && S.tpl.on && Object.keys(S.sh[k] || {}).length ? ' ex' : ''}" data-a=ydy data-k=${k}>${TRN[new Date(k + 'T12:00').getDay()]}<b>${k.slice(8)}</b></div>`).join('');
  const row = (lbl, cls, pick, flag) => `<div class=gr-bl>${lbl}</div>` + ds.map((k, i) => {
    if (sv[i][flag]) return '<div class="gr-c x"></div>';
    const o = trSh(k);
    return `<div class=gr-c data-a=ydy data-k=${k}>${PL.filter(p => pick(o[p.id] || '')).map(p => `<span class="gr-n ${cls}">${esc(p.n)}</span>`).join('')}</div>`;
  }).join('');
  const off = anyOff ? '<div class=gr-bl>Off</div>' + ds.map(k => { const o = trSh(k); return `<div class=gr-c data-a=ydy data-k=${k} style="min-height:0">${PL.filter(p => o[p.id] == 'R' || o[p.id] == 'F').map(p => `<span class="gr-n ${o[p.id] == 'F' ? 'f' : 'r'}">${esc(p.n)}</span>`).join('')}</div>`; }).join('') : '';
  return `<div class=row style="margin:12px 2px 6px"><b style="font:700 16px Georgia,serif">${trR(ds[0]).slice(0, 5)} – ${trR(ds[6]).slice(0, 5)}</b>${S.tpl && S.tpl.on ? `<span class=m>Sett. ${trDi(m) < 7 ? 'A' : 'B'}</span>` : E ? `<button class="g sm" data-a=ycp data-id=${m}>Copia sett. prec.</button>` : ''}</div><div class=gr><div></div>${hd}${row('Pranzo', '', c => c == 'P' || c == 'D', 'p')}${row('Cena', 'c', c => c == 'C' || c == 'D', 'c')}${off}</div>`;
}

function vTur() {
  const D = today(), E = can('edit'), cls = [...S.cl].sort((a, b) => a.a.localeCompare(b.a));
  const segs = [['gr','Griglia'],['per','Persone'], ...(E ? [['att','Attestati']] : [])];
  if (!segs.some(s => s[0] == trV)) trV = 'gr';
  const segBar = `<div class=sg>${segs.map(([k, l]) => `<button data-a=yv data-id=${k} class="${k == trV ? 'on' : ''}">${l}${k == 'att' && (attStat().ex || attStat().soon) ? ' •' : ''}</button>`).join('')}</div>`;
  if (trV == 'att') return segBar + vAtt();
  if (stTeam() && E) Cloud.loadTeam().then(ch => { if (ch) refresh(); }).catch(() => {});
  const two = [...Array(14)].map((_, i) => trD(trW, i)), PL = stVis(two);
  const meP = stTeam() && Cloud.user && S.st.find(p => p.id == Cloud.user.id && !p.ex);
  const loose = stTeam() && E ? S.st.filter(p => !p.u) : [];
  const wkP = (p, m) => `<div class=m style="font-size:10px;margin-top:6px">${trR(m).slice(0, 5)} – ${trR(trD(m, 6)).slice(0, 5)}</div><div style="display:flex;gap:3px">${[...Array(7)].map((_, i) => {
    const k = trD(m, i), c = trSh(k)[p.id] || '', sv = trSvc(k), full = sv.p && sv.c;
    return `<div class="tw-wc${k == D ? ' tdy' : ''}${E ? '' : ' ro'}"${full || !E ? '' : ` data-a=ycell data-id=${p.id} data-k=${k}`}><span>${'dlmmgvs'[new Date(k + 'T12:00').getDay()]}</span><b>${k.slice(8)}</b><div class="tw-k ${full ? 'xc' : c ? 's' + c : ''}">${full ? '' : c}</div></div>`;
  }).join('')}</div>`;
  return `<div class=row style="margin-bottom:10px"><div class=row style="gap:6px"><button class=g data-a=ytn>‹</button><button class=g data-a=ytt>Oggi</button><button class=g data-a=ytp>›</button></div>${E ? (stTeam() ? '<button class=g data-a=tab data-id=stf>Invita</button>' : '<button data-a=yst>+ Persona</button>') : ''}</div>`
    + (meP ? `<div class=card style="border-color:var(--g)"><div class=row><b>I tuoi turni</b><span class=m>${esc(meP.n)}</span></div>${wkP(meP, trW)}${wkP(meP, trD(trW, 7))}</div>` : '')
    + (loose.length ? `<div class=card style="border-color:var(--g)"><b>Persone da collegare a un account</b><div class=m style="margin:4px 0 6px">Inserite a mano prima dell'account: collegale per non perdere i loro turni.</div>${loose.map(p => `<div class=row style="margin-top:6px"><span>${esc(p.n)}</span><button class="g sm" data-a=ylk data-id=${p.id}>Collega</button></div>`).join('')}</div>` : '')
    + (PL.length && E ? trLockCard() : '')
    + (PL.length
      ? segBar
        + (trV == 'gr'
          ? (E ? `<div class=m style="margin:0 2px">Tocca un giorno per assegnare i turni di pranzo e cena.</div>` : '') + grWeek(trW) + grWeek(trD(trW, 7)) + `<div class=m style="margin:0 2px 12px">Riga Off: riposo (tratteggiato) e ferie (grigio).</div>`
          : (E ? `<div class=m style="margin:0 2px 8px">Tocca un giorno per cambiare il turno di quella persona.</div>` : '') + PL.map(p => `<div class=card><div class=row><b ${E && !p.u ? `data-a=${stTeam() ? 'ylk' : 'yes'} data-id=${p.id} style="cursor:pointer"` : ''}>${esc(p.n)}${p.ex ? ' <span class=m>(uscito dalla brigata)</span>' : ''}</b><span class=m>${esc(p.r)}</span></div>${wkP(p, trW)}${wkP(p, trD(trW, 7))}</div>`).join('') + `<div class=m style="margin:0 2px 12px">${TRC.map(([c, l]) => `<span class="tc s${c}">${c}</span>${l}`).join('')}</div>`)
      : (E ? segBar : '') + `<div class=card><div class=m>${E ? (stTeam() ? 'Le persone dei turni sono gli account della brigata: invita i cuochi e i responsabili da Staff e compaiono qui da soli.' : 'Aggiungi le persone della brigata per compilare i turni: due settimane alla volta, con pranzo, cena, doppio, riposo e ferie.') : 'I turni non sono ancora stati compilati.'}</div></div>`)
    + `<div class=card><b>Chiusure del ristorante</b>`
    + (E ? `<div class=m style="margin:6px 0 4px">Chiusura settimanale: tocca per chiudere il pranzo, la cena o entrambi</div><table class=tw>${[1,2,3,4,5,6,0].map(w => {
        const v = S.cw[w] || '', L = v == 'P' || v == 'T', C = v == 'C' || v == 'T';
        return `<tr><td style="width:40px;font-weight:600">${TRN[w]}</td><td><button class="${L ? '' : 'g'}" data-a=ycw data-id="${w}P" style="width:100%;padding:7px 2px;font-size:12px">Pranzo${L ? ' chiuso' : ''}</button></td><td><button class="${C ? '' : 'g'}" data-a=ycw data-id="${w}C" style="width:100%;padding:7px 2px;font-size:12px">Cena${C ? ' chiusa' : ''}</button></td></tr>`;
      }).join('')}</table>`
      : `<div class=m style="margin-top:6px">${[1,2,3,4,5,6,0].filter(w => S.cw[w]).map(w => TRN[w] + ' ' + ({P:'pranzo', C:'cena', T:'tutto il giorno'})[S.cw[w]]).join(' · ') || 'Nessuna chiusura settimanale.'}</div>`)
    + `<div class=m style="margin:12px 0 2px">Periodi di chiusura (ferie, lavori…)</div>`
    + (cls.map(c => `<div class=li style="${c.b < D ? 'opacity:.5' : ''}"><div class=row><div><b>${trR(c.a)}${c.a != c.b ? ' – ' + trR(c.b) : ''}</b><div class=m>${esc(c.n)}${c.a <= D && D <= c.b ? ' · in corso' : ''}</div></div>${E ? `<button class="g d sm" data-a=ydc data-id=${c.id}>✕</button>` : ''}</div></div>`).join('') || '<div class=m>Nessun periodo impostato.</div>')
    + (E ? `<button class=g data-a=ycl style="margin-top:10px">+ Periodo di chiusura</button>` : '') + `</div>`;
}

Object.assign(A, {
  ysl: () => {
    if (!confirm('Bloccare le due settimane mostrate come piano fisso? Si ripeteranno ogni due settimane finché non le modifichi.')) return;
    const ks = [...Array(14)].map((_, i) => trD(trW, i)), d = {};
    ks.forEach((k, i) => { d[i] = {...trSh(k)}; });
    S.tpl = {on:true, a:trW, d};
    ks.forEach(k => delete S.sh[k]);
    save(); act('turni', 'Piano turni fisso bloccato'); draw();
  },
  ysb: () => {
    if (!confirm('Sbloccare il piano fisso? Le due settimane mostrate restano come sono e da lì torni a gestire i turni settimana per settimana.')) return;
    [...Array(14)].forEach((_, i) => { const k = trD(trW, i); S.sh[k] = {...trSh(k)}; });
    S.tpl = null; save(); act('turni', 'Piano turni fisso sbloccato'); draw();
  },
  ydy: (id, el) => trDay(el.dataset.k), yv: id => { trV = id; draw(); },
  ytn: () => { trW = trD(trW, -7); draw(); }, ytp: () => { trW = trD(trW, 7); draw(); }, ytt: () => { trW = trMon(today()); draw(); },
  ycell: (id, el) => trPick(id, el.dataset.k), ylk: id => stLink(id), yst: () => trSt(), yes: id => trSt(id), ycl: () => trCl(),
  ydc: id => { S.cl = S.cl.filter(x => x.id != id); save(); draw(); },
  ycw: id => {
    const w = id.slice(0, -1), s = id.slice(-1), v = S.cw[w] || '';
    let L = v == 'P' || v == 'T', C = v == 'C' || v == 'T';
    if (s == 'P') L = !L; else C = !C;
    const nv = L && C ? 'T' : L ? 'P' : C ? 'C' : '';
    if (nv) S.cw[w] = nv; else delete S.cw[w];
    save(); draw();
  },
  ycp: id => trCopy(id)
});
