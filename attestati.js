// Brigata — attestati e corsi del personale con scadenze
// Visibili e modificabili solo da titolare e responsabile.
'use strict';

// durata proposta in anni (0 = da impostare a mano). Sono solo proposte: verifica sempre con il consulente.
const ATT = [
  ['Formazione alimentarista (HACCP)', 0, 'La validità cambia da regione a regione: imposta la scadenza indicata sull\'attestato.'],
  ['Sicurezza lavoratori (generale e specifica)', 5, 'Aggiornamento proposto ogni 5 anni.'],
  ['Antincendio', 5, 'Aggiornamento proposto ogni 5 anni.'],
  ['Primo soccorso', 3, 'Aggiornamento proposto ogni 3 anni.'],
  ['Preposto', 2, 'Aggiornamento proposto ogni 2 anni.'],
  ['RSPP datore di lavoro', 5, 'Aggiornamento proposto ogni 5 anni.'],
  ['RLS', 1, 'Aggiornamento proposto ogni anno.'],
  ['Altro', 0, '']
];
const ATTW = 60;   // giorni di preavviso
const attK = a => !a.e ? 9999 : days(a.e);
const attCls = a => { const k = attK(a); return k < 0 ? 'bad' : k <= ATTW ? 'warn' : ''; };
const attTxt = a => { if (!a.e) return 'senza scadenza'; const k = days(a.e); return k < 0 ? `scaduto il ${trR(a.e)}` : k == 0 ? 'scade oggi' : k <= ATTW ? `scade tra ${k} giorni (${trR(a.e)})` : `valido fino al ${trR(a.e)}`; };
const attStat = () => ({ex: S.att.filter(a => a.e && days(a.e) < 0).length, soon: S.att.filter(a => a.e && days(a.e) >= 0 && days(a.e) <= ATTW).length});
const addY = (d, y) => { const x = new Date(d + 'T12:00'); x.setFullYear(x.getFullYear() + y); return x.toLocaleDateString('sv'); };

function eAtt(id, person) {
  const n = !id, a = S.att.find(x => x.id == id) || {id:uid(), p:person || '', t:ATT[0][0], d:'', e:'', o:'', x:''};
  const known = ATT.some(t => t[0] == a.t);
  const people = [...new Set([...S.st.map(p => p.n), ...S.att.map(x => x.p), ...((Cloud.members || []).map(m => m.name))].filter(Boolean))].sort();
  ed(n ? 'Nuovo attestato' : 'Attestato',
    `<input name=p list=atp placeholder="Persona" value="${esc(a.p)}"><datalist id=atp>${people.map(p => `<option value="${esc(p)}">`).join('')}</datalist>
     <select name=t>${ATT.map(([t]) => `<option ${t == (known ? a.t : 'Altro') ? 'selected' : ''}>${t}</option>`).join('')}</select>
     <input name=tc placeholder="Nome del corso" value="${known ? '' : esc(a.t)}" style="display:${known ? 'none' : 'block'}">
     <div class=hint id=ath></div>
     <div class=row><div style="flex:1"><div class=m>Data del corso</div><input name=d type=date value="${a.d}"></div><div style="flex:1"><div class=m>Scadenza</div><input name=e type=date value="${a.e}"></div></div>
     <input name=o placeholder="Ente / organizzazione (facoltativo)" value="${esc(a.o)}">
     <input name=x placeholder="Note (n. attestato, ore…)" value="${esc(a.x)}">`,
    d => {
      const p = v(d, 'p').trim(), t = v(d, 't') == 'Altro' ? v(d, 'tc').trim() || 'Altro' : v(d, 't');
      if (!p) { alert('Scrivi il nome della persona.'); return false; }
      if (v(d, 'd') && v(d, 'e') && v(d, 'e') < v(d, 'd')) { alert('La scadenza è prima della data del corso.'); return false; }
      Object.assign(a, {p, t, d:v(d, 'd'), e:v(d, 'e'), o:v(d, 'o').trim(), x:v(d, 'x').trim()});
      if (n) { S.att.push(a); act('attestato', `${p}: ${t}${a.e ? ' · scade ' + trR(a.e) : ''}`); }
    }, n ? '' : `<button type=button class="g d" id=atx>Elimina</button>`);
  const D = $('#d'), sel = D.querySelector('[name=t]'), dd = D.querySelector('[name=d]'), ee = D.querySelector('[name=e]');
  let auto = !a.e;   // la scadenza si calcola da sola finché non la cambi a mano
  const info = () => {
    const P = ATT.find(t => t[0] == sel.value);
    D.querySelector('[name=tc]').style.display = sel.value == 'Altro' ? 'block' : 'none';
    $('#ath').textContent = P ? P[2] : '';
    if (auto && P && P[1] && dd.value) ee.value = addY(dd.value, P[1]);
  };
  sel.onchange = info; dd.onchange = info; ee.oninput = () => { auto = false; };
  info();
  if (!n) $('#atx').onclick = () => { if (confirm('Eliminare questo attestato?')) { S.att = S.att.filter(x => x.id != a.id); save(); D.close(); } };
}

function vAtt() {
  const st = attStat(), by = {};
  S.att.forEach(a => (by[a.p] = by[a.p] || []).push(a));
  S.st.forEach(p => { if (!by[p.n]) by[p.n] = []; });
  const names = Object.keys(by).sort((x, y) => Math.min(...by[x].map(attK), 9999) - Math.min(...by[y].map(attK), 9999) || x.localeCompare(y));
  return `<div class="row st" style="margin-bottom:10px"><button data-a=atn>+ Attestato</button>${S.att.length ? '<button class=g data-a=ats>Condividi scadenze</button><button class=g data-a=print>Stampa</button>' : ''}</div>`
    + (st.ex || st.soon ? `<div class="card" style="border-color:${st.ex ? 'var(--r)' : 'var(--g)'}">${st.ex ? `<div class=bad>${st.ex == 1 ? '1 attestato scaduto' : st.ex + ' attestati scaduti'}</div>` : ''}${st.soon ? `<div class=warn>${st.soon} in scadenza nei prossimi ${ATTW} giorni</div>` : ''}<div class=m style="margin-top:4px">Prenota per tempo l'aggiornamento dei corsi.</div></div>` : '')
    + (names.map(nm => `<div class=card><div class=row><b>${esc(nm)}</b><button class="g sm np" data-a=atp data-id="${esc(nm)}">+ Corso</button></div>`
      + (by[nm].sort((a, b) => attK(a) - attK(b)).map(a => `<div class=li data-a=ate data-id=${a.id} style="cursor:pointer"><div>${esc(a.t)}</div><div class="m ${attCls(a)}" style="font-size:13px">${attTxt(a)}${a.o ? ' · ' + esc(a.o) : ''}</div></div>`).join('') || '<div class=m style="margin-top:6px">Nessun attestato inserito.</div>')
      + `</div>`).join('') || `<div class=empty>Inserisci gli attestati della brigata (HACCP, sicurezza, antincendio, primo soccorso…): Brigata ti avvisa ${ATTW} giorni prima della scadenza.</div>`)
    + `<div class="m np" style="margin:6px 2px 12px">Le durate proposte sono indicative: verifica sempre la scadenza riportata sull'attestato e gli obblighi con il tuo consulente. Gli attestati li vedono solo titolare e responsabili.</div>`;
}

const attShare = () => shareText('Attestati da rinnovare' + (S.loc ? ' — ' + S.loc : '') + '\n' + ([...S.att].filter(a => a.e && days(a.e) <= ATTW).sort((a, b) => a.e.localeCompare(b.e)).map(a => `• ${a.p} — ${a.t}: ${attTxt(a)}`).join('\n') || 'Nessun attestato scaduto o in scadenza.'));

Object.assign(A, {atn: () => eAtt(), ate: id => eAtt(id), atp: id => eAtt(null, id), ats: () => attShare()});
