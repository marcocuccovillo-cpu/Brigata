// Brigata — HACCP: temperature, lotti e scadenze, pulizie, registro
'use strict';

let peProf = false;
let hMo = '';   // mese del registro mostrato (AAAA-MM)

function eTemp(id) {
  const u = S.u.find(x => x.id == id); if (!u) return;
  ed(esc(u.n), `<input name=t type=number step=0.1 inputmode=decimal placeholder="Temperatura °C (ammessi ${u.a} / ${u.b})"><input name=note placeholder="Azione correttiva (se fuori range)">`, d => {
    const raw = v(d, 't'); if (raw === '') return false;
    const t = num(raw), ok = t >= u.a && t <= u.b;
    if (!ok && !v(d, 'note').trim()) { alert('Fuori range: indica l\'azione correttiva.'); return false; }
    S.log.push({id:uid(), u:u.id, n:u.n, t, ok, note:v(d, 'note').trim(), d:today(), h:hm(), by:me()});
    act('temp', `${u.n}: ${t}°${ok ? '' : ' FUORI RANGE — ' + v(d, 'note').trim()}`);
  });
  setTimeout(() => { const i = $('#d [name=t]'); if (i) i.focus(); }, 50);
}

const nUnit = () => ed('Nuova zona', `<input name=n placeholder="Nome (es. Frigo verdure)"><div class=row><input name=a type=number inputmode=decimal placeholder="Min °C"><input name=b type=number inputmode=decimal placeholder="Max °C"></div>`, d => {
  if (!v(d, 'n').trim() || v(d, 'a') === '' || v(d, 'b') === '') return false;
  const a = num(v(d, 'a')), b = num(v(d, 'b'));
  S.u.push({id:uid(), n:v(d, 'n').trim(), a:Math.min(a, b), b:Math.max(a, b)});
});

const nLot = () => {
  ed('Nuovo lotto', `<input name=n placeholder="Prodotto"><input name=l placeholder="Lotto / fornitore"><div class=m>Scadenza</div><input name=e type=date>`, d => {
    if (!v(d, 'n').trim() || !v(d, 'e')) return false;
    S.lots.push({id:uid(), n:v(d, 'n').trim(), l:v(d, 'l').trim(), e:v(d, 'e'), by:me()});
    act('lotto', `${v(d, 'n').trim()}${v(d, 'l').trim() ? ' · lotto ' + v(d, 'l').trim() : ''} · scade ${dm(v(d, 'e'))}`);
  }, `<button type=button class=g id=lsc>Scansiona</button>`);
  $('#lsc').onclick = () => scLot();
};

const nTask = () => ed('Nuovo compito di pulizia', `<input name=n placeholder="Compito">`, d => {
  if (!v(d, 'n').trim()) return false;
  S.t.push({id:uid(), n:v(d, 'n').trim()});
});

const vPr = () => {
  const E = can('edit'), none = !S.prof && !S.u.length && !S.t.length;
  if (!E) return '';
  if (peProf || none) return `<div class=card><b>Profilo attività</b><div class=m>Scegli il tipo di locale: carica zone di temperatura e pulizie tipiche, poi modificale. Verifica i limiti con il tuo piano HACCP.</div>${Object.keys(PRE).map(k => `<button class=g data-a=pre data-id="${k}" style="margin:8px 6px 0 0">${k}</button>`).join('')}${peProf && !none ? '<div><button class=g data-a=xpp style="margin-top:10px">Annulla</button></div>' : ''}</div>`;
  return `<div class=row style="margin:0 2px 10px"><span class=m>Profilo attività: <b>${esc(S.prof || 'personalizzato')}</b></span><button class="g sm" data-a=xpc>Cambia</button></div>`;
};

function vH() {
  const D = today(), E = can('edit'), L = [...S.log].sort((a, b) => (b.d + b.h).localeCompare(a.d + a.h));
  const mos = [...new Set([D.slice(0, 7), ...S.log.map(x => x.d.slice(0, 7))])].sort().reverse();
  if (!hMo || !mos.includes(hMo)) hMo = mos[0];
  const LM = L.filter(x => x.d.slice(0, 7) == hMo);
  const lots = [...S.lots, ...S.pr.filter(x => x.e).map(x => ({...x, mag:1}))].sort((a, b) => a.e.localeCompare(b.e));
  return `${vPr()}<div class="card np"><b>Temperature</b>${S.u.map(u => {
      const l = L.find(x => x.u == u.id), td = l && l.d == D;
      return `<div class=row style="margin-top:8px"><div>${esc(u.n)}<div class=m>${u.a}° / ${u.b}°${l ? ` · ultima <span class="${l.ok ? '' : 'bad'}">${l.t}°</span> ${td ? 'oggi' : dm(l.d)} ${l.h}${l.by ? ' · ' + esc(l.by) : ''}` : ''}</div></div><div class=row><button data-a=temp data-id=${u.id} class="${td ? 'g' : ''}">Registra</button>${E ? `<button class="g d" data-a=du data-id=${u.id}>✕</button>` : ''}</div></div>`;
    }).join('') || `<div class=m>Nessuna zona${E ? ': aggiungila o scegli un profilo attività.' : '.'}</div>`}${E ? '<button class=g data-a=nu style="margin-top:10px">+ Zona</button>' : ''}</div>
  <div class="card np"><b>Lotti e scadenze</b>${lots.map(x => {
      const k = days(x.e);
      return `<div class=row style="margin-top:8px"><div>${esc(x.n)}<div class=m>${x.mag ? (x.pp ? 'preparazione' + (x.d ? ' del ' + dm(x.d) : '') : 'magazzino') : esc(x.l)}${x.l && x.mag ? ' · lotto ' + esc(x.l) : ''} · scade ${dm(x.e)}</div></div><div class=row><span class="${k < 0 ? 'bad' : k <= 2 ? 'warn' : ''}">${k < 0 ? 'scaduto' : k == 0 ? 'oggi' : k + ' g'}</span>${x.mag ? '' : `<button class="g d" data-a=dl data-id=${x.id}>✕</button>`}</div></div>`;
    }).join('') || '<div class=m style="margin-top:6px">Nessun lotto. Anche i prodotti del Magazzino con scadenza compaiono qui.</div>'}<button class=g data-a=nl style="margin-top:10px">+ Lotto</button></div>
  <div class="card np"><b>Pulizie di oggi</b>${S.t.map(t => {
      const dn = S.done[D + t.id];
      return `<div class=row><label class=chk><input type=checkbox data-a=done data-id=${t.id} ${dn ? 'checked' : ''}>${esc(t.n)}</label><span class=m style="font-size:12px">${dn && dn.h ? dn.h + (dn.by ? ' · ' + esc(dn.by) : '') : ''}</span>${E ? `<button class="g d sm" data-a=dt data-id=${t.id}>✕</button>` : ''}</div>`;
    }).join('') || '<div class=m>Nessun compito.</div>'}${E ? '<button class=g data-a=nt style="margin-top:10px">+ Compito</button>' : ''}</div>
  <div class=card><div class=row><b>Registro temperature</b><button class="g np sm" data-a=print>Stampa</button></div>
  <select id=hmo class=np style="margin:8px 0 0">${mos.map(m => `<option value=${m} ${m == hMo ? 'selected' : ''}>${new Date(m + '-15').toLocaleDateString('it', {month:'long', year:'numeric'})}</option>`).join('')}</select>
  <div class=m style="margin-top:4px">${S.loc ? esc(S.loc) + ' · ' : ''}${new Date(hMo + '-15').toLocaleDateString('it', {month:'long', year:'numeric'})}</div>
  <table style="margin-top:6px"><tr><th>Data</th><th>Zona</th><th>°C</th><th>Chi</th><th>Azione</th></tr>${LM.map(x => `<tr><td>${dm(x.d)} ${x.h}</td><td>${esc(x.n)}</td><td class="${x.ok ? '' : 'bad'}">${x.t}°</td><td class=m>${esc(x.by || '')}</td><td class=m>${esc(x.note)}</td></tr>`).join('') || '<tr><td colspan=5 class=m>Nessuna lettura in questo mese.</td></tr>'}</table></div>`;
}

Object.assign(A, {
  temp: id => eTemp(id), nu: () => nUnit(), du: id => del('u', id), nt: () => nTask(), nl: () => nLot(), dl: id => del('lots', id), dt: id => del('t', id),
  xpc: () => { peProf = true; draw(); }, xpp: () => { peProf = false; draw(); },
  done: (id, el) => {
    const t = S.t.find(x => x.id == id);
    S.done[today() + id] = el.checked ? {h:hm(), by:me()} : 0;
    save(); draw();
    if (el.checked && t) act('pulizia', t.n);
  },
  pre: id => {
    if ((S.u.length || S.t.length) && !confirm('Sostituire zone e pulizie attuali?')) return;
    S.u = PRE[id].u.map(([n, a, b]) => ({id:uid(), n, a, b}));
    S.t = PRE[id].t.map(n => ({id:uid(), n}));
    S.prof = id; peProf = false; save(); tab = 'hac'; draw();
  }
});
document.addEventListener('change', e => { if (e.target.id == 'hmo') { hMo = e.target.value; draw(); } });
