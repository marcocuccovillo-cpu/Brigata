// Brigata — Libro prenotazioni: rilevazioni, clienti serviti, grafici e previsioni
'use strict';

let hx = false;

const bars = a => { const m = Math.max(1, ...a.map(x => x[1])); return `<div style="display:flex;gap:3px;align-items:flex-end;margin-top:10px">${a.map(([l, n]) => `<div style="flex:1;text-align:center"><div class=m style="font-size:10px">${n || ''}</div><div style="background:var(--g);height:${Math.round(n / m * 64)}px;min-height:${n ? 2 : 0}px;border-radius:3px 3px 0 0"></div><div class=m style="font-size:10px">${l}</div></div>`).join('')}</div>`; };
const dbars = a => { const m = Math.max(1, ...a.map(x => x[1])); return `<div id=hs style="display:flex;gap:4px;align-items:flex-end;margin-top:10px;overflow-x:auto;padding-bottom:4px">${a.map(([k, n], i) => `<div style="flex:0 0 26px;text-align:center"><div class=m style="font-size:10px;height:14px">${n || ''}</div><div style="background:var(--g);height:${Math.round(n / m * 64)}px;min-height:${n ? 2 : 0}px;border-radius:3px 3px 0 0"></div><div class=m style="font-size:10px">${k.slice(8)}</div><div style="font-size:9px;color:var(--a);height:12px">${i == 0 || k.slice(8) == '01' || (a.length - 1 - i) % 7 == 0 ? new Date(k + 'T12:00').toLocaleDateString('it', {month:'short'}) : ''}</div></div>`).join('')}</div>`; };

// previsione: rapporto medio serviti/prenotati delle ultime 12 serate chiuse dello stesso turno
const prev = x => {
  if (x.p == null) return null;
  const h = S.pren.filter(y => y.t == x.t && y.s != null && y.p > 0 && y.id != x.id).sort((a, b) => a.d.localeCompare(b.d)).slice(-12);
  if (h.length < 3) return null;
  return Math.round(x.p * h.reduce((s, y) => s + y.s, 0) / h.reduce((s, y) => s + y.p, 0));
};

function ePren(id, dd, tt) {
  const n = !id, r = S.pren.find(x => x.id == id) || {id:uid(), d:dd || today(), t:tt || (new Date().getHours() < 16 ? 'Pranzo' : 'Cena'), p:null, s:null, n:''};
  ed(n ? 'Nuova rilevazione' : 'Rilevazione',
    `<div class=m>Foto del libro prenotazioni: serve per contare, non viene salvata.</div><input type=file accept="image/*" capture=environment id=ph><img id=pv alt="" style="display:none;width:100%;max-height:45vh;object-fit:contain;border-radius:8px">
     <div class=row><input name=d type=date value="${r.d}"><select name=t>${['Pranzo','Cena','Giornaliera'].map(t => `<option ${t == r.t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
     <div class=row><button type=button class=g id=mn>−</button><input name=p type=number min=0 inputmode=numeric placeholder="Prenotazioni" value="${r.p ?? ''}"><button type=button id=pl>+</button></div>
     <input name=s type=number min=0 inputmode=numeric placeholder="Clienti serviti (a fine servizio)" value="${r.s ?? ''}">
     <input name=n placeholder="Note (evento, meteo…)" value="${esc(r.n)}">
     ${n ? '<label class=chk><input type=checkbox name=more>Poi inserisci il giorno prima (per compilare il passato)</label>' : ''}`,
    d => {
      const dt = v(d, 'd'), t = v(d, 't'), pv = v(d, 'p'), sv = v(d, 's');
      if (!dt || (pv === '' && sv === '')) return false;
      const o = {d:dt, t, p:pv === '' ? null : +pv, s:sv === '' ? null : +sv, n:v(d, 'n').trim()};
      const ex = S.pren.find(x => x.d == dt && x.t == t && x.id != r.id);
      if (ex) { Object.assign(ex, o); S.pren = S.pren.filter(x => x.id != r.id); }
      else { Object.assign(r, o); if (n) S.pren.push(r); }
      if (o.s != null) act('pren', `${t} ${fd(dt)}: ${o.s} clienti serviti${o.p != null ? ' su ' + o.p + ' prenotati' : ''}`);
      if (n && d.querySelector('[name=more]').checked) setTimeout(() => ePren(null, trD(dt, -1), t), 0);
    });
  $('#ph').onchange = e => { const f = e.target.files[0]; if (f) { const i = $('#pv'); i.src = URL.createObjectURL(f); i.style.display = 'block'; } };
  const pi = $('#d [name=p]');
  $('#pl').onclick = () => pi.value = (+pi.value || 0) + 1;
  $('#mn').onclick = () => pi.value = Math.max(0, (+pi.value || 0) - 1);
}

const eClose = id => {
  const r = S.pren.find(x => x.id == id);
  ed('Clienti serviti · ' + r.t + ' ' + fd(r.d), `<input name=s type=number min=0 inputmode=numeric placeholder="Numero definitivo di clienti serviti" value="${r.s ?? ''}"><input name=n placeholder="Note" value="${esc(r.n)}">`, d => {
    if (v(d, 's') === '') return false;
    r.s = +v(d, 's'); r.n = v(d, 'n').trim();
    act('pren', `${r.t} ${fd(r.d)}: ${r.s} clienti serviti${r.p != null ? ' su ' + r.p + ' prenotati' : ''}`);
  });
};

function vP() {
  const P = [...S.pren].sort((a, b) => b.d.localeCompare(a.d) || a.t.localeCompare(b.t)), done = P.filter(x => x.s != null), open = P.filter(x => x.s == null && x.d <= today()), dmp = {};
  done.forEach(x => dmp[x.d] = (dmp[x.d] || 0) + x.s);
  const wa = [1,2,3,4,5,6,0].map(w => { const ds = Object.keys(dmp).filter(d => wd(d) == w); return [WD[w], ds.length ? Math.round(ds.reduce((s, d) => s + dmp[d], 0) / ds.length) : 0]; });
  const ks = Object.keys(dmp).sort(), all = [];
  if (ks.length) {
    const lim = new Date(); lim.setDate(lim.getDate() - 365);
    const d = new Date(Math.max(new Date(ks[0] + 'T12:00'), lim)), tk = today();
    for (;;) { const k = d.toLocaleDateString('sv'); all.push([k, dmp[k] || 0]); if (k >= tk) break; d.setDate(d.getDate() + 1); }
  }
  return `<button data-a=np class=w style="margin-bottom:12px">+ Nuova rilevazione</button>`
    + (open.length ? `<div class=card><b>Da chiudere</b>${open.map(x => { const f = prev(x); return `<div class=row style="margin-top:10px"><div>${fd(x.d)} · ${x.t}<div class=m>${x.p ?? '–'} prenotazioni${f ? ` · previsti circa <b>${f}</b> clienti` : ''}</div></div><button data-a=cl data-id=${x.id}>Chiudi</button></div>`; }).join('')}</div>` : '')
    + (done.length
      ? `<div class=card><b>Clienti serviti per giorno della settimana</b><div class=m>Media sulle serate registrate</div>${bars(wa)}</div><div class=card><b>Tutti i giorni</b><div class=m>Clienti serviti · ${all.length} giorni, scorri per vedere i precedenti</div>${dbars(all)}</div>`
      : '<div class="card m">Registra e chiudi qualche serata: grafici e previsioni compaiono da soli. Per la previsione servono almeno 3 serate chiuse per turno.</div>')
    + `<div class=card><div class=row data-a=xhx style="cursor:pointer"><div><b>Storico</b><div class=m>${P.length} rilevazioni</div></div><div style="text-align:right"><b style="font-size:20px">${done.reduce((a, x) => a + x.s, 0).toLocaleString('it')}</b> <span class=m>serviti ${hx ? '▴' : '▾'}</span></div></div>`
    + (done.length ? `<div class=m style="margin-top:4px">${[...new Set(done.map(x => x.t))].map(t => t + ' ' + done.filter(x => x.t == t).reduce((a, x) => a + x.s, 0).toLocaleString('it')).join(' · ')}</div>` : '')
    + (hx ? `<div style="max-height:60vh;overflow-y:auto;margin-top:8px"><table>${P.map(x => `<tr data-a=ep data-id=${x.id} style="cursor:pointer"><td>${fd(x.d)}</td><td>${x.t}</td><td>${x.p ?? '–'} pren.</td><td><b>${x.s ?? '…'}</b></td><td><button class="g d sm" data-a=dp data-id=${x.id}>✕</button></td></tr>`).join('') || '<tr><td class=m>Nessuna rilevazione.</td></tr>'}</table></div>` : '')
    + `</div>`;
}

Object.assign(A, {np: () => ePren(), ep: id => ePren(id), cl: id => eClose(id), dp: id => del('pren', id), xhx: () => { hx = !hx; draw(); }});
