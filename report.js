// Brigata — report del mese per il titolare
// Una pagina con i numeri che contano: clienti, food cost, scarti, magazzino, HACCP, personale.
'use strict';

let repM = '';
const mAdd = (m, k) => { const d = new Date(m + '-15T12:00'); d.setMonth(d.getMonth() + k); return d.toLocaleDateString('sv').slice(0, 7); };
const mName = m => new Date(m + '-15T12:00').toLocaleDateString('it', {month:'long', year:'numeric'});
const inM = (d, m) => String(d || '').slice(0, 7) == m;
const f1 = x => x.toLocaleString('it', {minimumFractionDigits:1, maximumFractionDigits:1});
const pct = (a, b) => b ? Math.round(a / b * 100) : null;

// giorni del mese fino a oggi, senza i giorni di chiusura completa
function openDays(m) {
  const out = [], t = today();
  for (let d = m + '-01'; d.slice(0, 7) == m && d <= t; d = trD(d, 1)) if (!trClosed(d)) out.push(d);
  return out;
}

function repStats(m) {
  const C = can('cost'), od = openDays(m);
  const pren = S.pren.filter(x => inM(x.d, m) && x.s != null);
  const serv = pren.reduce((a, x) => a + x.s, 0);
  const byWd = {}; pren.forEach(x => { const w = wd(x.d); byWd[w] = (byWd[w] || 0) + x.s; });
  const bestWd = Object.entries(byWd).sort((a, b) => b[1] - a[1])[0];
  // food cost teorico dei piatti in carta con prezzo
  const dishes = S.rec.filter(r => r.mn && r.pv > 0).map(r => ({n:r.n, fc:cost(r) / r.s / r.pv * 100, t:r.fc}));
  const fcAvg = dishes.length ? dishes.reduce((a, x) => a + x.fc, 0) / dishes.length : null;
  // scarti
  const sc = S.sc.filter(x => inM(x.d, m)), scB = sc.filter(x => x.dest == 'b'), scR = sc.filter(x => x.dest == 'r');
  const sum = (L, f) => L.reduce((a, x) => a + (f(x) || 0), 0);
  const topSc = Object.values(sc.reduce((o, x) => { const k = x.n.toLowerCase(); (o[k] = o[k] || {n:x.n, c:0}).c++; return o; }, {})).sort((a, b) => b.c - a.c).slice(0, 3);
  // inventario: ultimo del mese e precedente
  const invs = [...S.inv].sort((a, b) => a.d.localeCompare(b.d)), invM = invs.filter(x => inM(x.d, m)).pop();
  const invP = invM ? invs.filter(x => x.d < invM.d).pop() : null;
  // merce
  const rc = S.rc.filter(x => inM(x.d, m)), rj = rc.filter(x => x.es == 'r');
  const rjFo = Object.entries(rj.reduce((o, x) => { const n = (foById(x.fo) || {}).n || 'senza fornitore'; o[n] = (o[n] || 0) + 1; return o; }, {})).sort((a, b) => b[1] - a[1]);
  // HACCP
  const log = S.log.filter(x => inM(x.d, m)), logBad = log.filter(x => !x.ok);
  const covered = S.u.length ? od.filter(d => S.u.every(u => log.some(l => l.d == d && l.u == u.id))).length : null;
  const doneN = Object.keys(S.done).filter(k => inM(k.slice(0, 10), m) && S.done[k] && S.t.some(t => k.slice(10) == t.id) && od.includes(k.slice(0, 10))).length;
  const cleanPct = S.t.length && od.length ? pct(doneN, S.t.length * od.length) : null;
  const ab = S.ab.filter(x => inM(x.d, m) && x.e), abNc = ab.filter(x => x.ok === false);
  const mt = S.mt.filter(x => inM(x.d, m)), gu = mt.filter(x => x.ty == 'g');
  const exp = S.pr.filter(x => x.e && inM(x.e, m) && days(x.e) < 0).length;
  // personale
  const serviziPers = S.st.map(p => {
    let n = 0, dbl = 0;
    od.forEach(d => { const c = trSh(d)[p.id]; if (c == 'P' || c == 'C') n++; if (c == 'D') { n += 2; dbl++; } });
    return {n:p.n, s:n, d:dbl};
  }).filter(x => x.s);
  // tavolate
  const tv = S.tv.filter(x => inM(x.d, m));
  return {m, od:od.length, serv, nServ:pren.length, avg:pren.length ? Math.round(serv / pren.length) : 0, bestWd, fcAvg, dishes, over:dishes.filter(x => x.fc > x.t),
    sc, scB, scR, kgB:sum(scB, scKg), kgR:sum(scR, scKg), vB:C ? sum(scB, scVal) : 0, vR:C ? sum(scR, scVal) : 0, topSc,
    invM, invP, rc, rj, rjFo, log, logBad, covered, cleanPct, ab, abNc, mt, gu, guOpen:mtOpen().length, mtLate:mtDue().filter(x => days(x.sc) < 0).length,
    attEx:S.att.filter(a => a.e && days(a.e) < 0).length, exp, serviziPers, tv, tvP:tv.reduce((a, x) => a + (+x.p || 0), 0), tvE:tv.reduce((a, x) => a + (+x.p || 0) * (+x.pr || 0), 0)};
}

const delta = (a, b, unit, lowerBetter) => {
  if (b == null || a == null || !b) return '';
  const d = a - b, p = Math.round(d / Math.abs(b) * 100);
  if (!p) return '<span class=m> = mese prec.</span>';
  const good = lowerBetter ? d < 0 : d > 0;
  return ` <span class="${good ? 'ok' : 'bad'}" style="font-size:12px">${d > 0 ? '▲' : '▼'} ${Math.abs(p)}%</span>`;
};

function vRep() {
  if (!can('edit')) return '<div class=empty>Il report è riservato a titolare e responsabili.</div>';
  const cur = today().slice(0, 7);
  if (!repM) repM = cur;
  const s = repStats(repM), p = repStats(mAdd(repM, -1)), C = can('cost'), partial = repM == cur;
  const kpi = (v, l, d) => `<div><b>${v}</b><span>${l}</span>${d ? `<span>${d}</span>` : ''}</div>`;
  const ncTot = s.logBad.length + s.abNc.length + s.rj.length;
  const line = (l, v, c) => `<div class=row style="padding:6px 0;border-top:1px solid var(--b)"><span>${l}</span><b class="${c || ''}">${v}</b></div>`;
  const covTxt = s.covered == null ? '–' : `${s.covered}/${s.od} giorni`;
  return `<div class="row np" style="margin-bottom:10px;gap:6px"><button class=g data-a=rpp>‹</button><b style="flex:1;text-align:center;font:700 18px Georgia,serif;text-transform:capitalize">${mName(repM)}</b><button class=g data-a=rpn ${repM >= cur ? 'disabled' : ''}>›</button></div>`
    + `<div class="row st np" style="margin-bottom:10px"><button data-a=rps>Condividi</button><button class=g data-a=print>Stampa / PDF</button></div>`
    + `<div class=card><div class=kick>${esc(S.loc || 'Il tuo locale')}</div><h2 style="margin:4px 0 0">Report di ${mName(repM)}</h2><div class=m>${partial ? `Mese in corso: dati fino a oggi (${s.od} giorni di apertura)` : `${s.od} giorni di apertura`} · confronto con ${mName(p.m)}</div>
      <div class=kpi>${kpi(s.serv.toLocaleString('it'), 'clienti serviti', delta(s.serv, p.serv))}${C ? kpi(s.fcAvg == null ? '–' : f1(s.fcAvg) + '%', 'food cost medio') : kpi(s.nServ, 'servizi')}${kpi(ncTot, 'non conformità', delta(ncTot, p.logBad.length + p.abNc.length + p.rj.length, '', true))}</div></div>`

    + `<div class=card><b>Clienti</b>${line('Clienti serviti', s.serv.toLocaleString('it') + delta(s.serv, p.serv))}${line('Servizi registrati', s.nServ)}${line('Media per servizio', s.avg + delta(s.avg, p.avg))}${s.bestWd ? line('Giorno migliore', ['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato'][s.bestWd[0]] + ` (${s.bestWd[1]})`) : ''}${s.tv.length ? line('Tavolate a menù fisso', `${s.tv.length} · ${s.tvP} persone${C && s.tvE ? ' · ' + eur(s.tvE) : ''}`) : ''}${!s.nServ ? '<div class=hint>Chiudi i servizi nel Libro prenotazioni per vedere i clienti.</div>' : ''}</div>`

    + (C ? `<div class=card><b>Food cost dei piatti in carta</b>${s.dishes.length ? line('Food cost teorico medio', f1(s.fcAvg) + '%') + line('Piatti sopra il target', s.over.length, s.over.length ? 'bad' : 'ok') + (s.over.length ? `<div class=m style="margin-top:6px">${s.over.sort((a, b) => b.fc - a.fc).slice(0, 5).map(x => `${esc(x.n)} <b class=bad>${f1(x.fc)}%</b> <span class=m>(target ${x.t}%)</span>`).join(' · ')}</div>` : '') : '<div class=m style="margin-top:6px">Inserisci il prezzo di vendita nelle ricette del menù per calcolarlo.</div>'}<div class=hint>Calcolato sui prezzi attuali degli ingredienti.</div></div>` : '')

    + `<div class=card><b>Scarti di produzione</b>${line('Registrazioni', s.sc.length + delta(s.sc.length, p.sc.length, '', true))}${line('Buttati', `${s.scB.length}${s.kgB ? ' · ' + f1(s.kgB) + ' kg' : ''}${C && s.vB ? ' · ' + eur(s.vB) : ''}`, s.scB.length ? 'bad' : '')}${line('Recuperati', `${s.scR.length}${s.kgR ? ' · ' + f1(s.kgR) + ' kg' : ''}${C && s.vR ? ' · ' + eur(s.vR) : ''}`)}${s.sc.length ? line('Quota recuperata', pct(s.scR.length, s.sc.length) + '%') : ''}${s.topSc.length ? `<div class=m style="margin-top:6px">Più scartati: ${s.topSc.map(x => `${esc(x.n)} (${x.c})`).join(', ')}</div>` : ''}${s.exp ? line('Prodotti scaduti in magazzino', s.exp, 'bad') : ''}</div>`

    + `<div class=card><b>Magazzino e merce</b>${s.invM ? line('Inventario del ' + dm(s.invM.d), C ? eur(s.invM.tot) + (s.invP ? delta(s.invM.tot, s.invP.tot) : '') : s.invM.r.length + ' prodotti') : line('Inventario', 'non fatto questo mese', 'warn')}${line('Consegne controllate', s.rc.length)}${line('Merce respinta', s.rj.length, s.rj.length ? 'bad' : '')}${s.rjFo.length ? `<div class=m style="margin-top:6px">Respinti per fornitore: ${s.rjFo.map(([n, c]) => `${esc(n)} (${c})`).join(', ')}</div>` : ''}</div>`

    + `<div class=card><b>HACCP</b>${line('Letture di temperatura', s.log.length)}${line('Giorni con tutte le zone registrate', covTxt, s.covered != null && s.covered < s.od ? 'warn' : '')}${line('Temperature fuori range', s.logBad.length, s.logBad.length ? 'bad' : 'ok')}${s.cleanPct != null ? line('Pulizie completate', s.cleanPct + '%', s.cleanPct < 90 ? 'warn' : 'ok') : ''}${line('Abbattimenti', s.ab.length + (s.abNc.length ? ` · <span class=bad>${s.abNc.length} non ${s.abNc.length == 1 ? 'conforme' : 'conformi'}</span>` : ''))}${line('Guasti segnalati', s.gu.length + (s.guOpen ? ` · <span class=bad>${s.guOpen} ${s.guOpen == 1 ? 'ancora aperto' : 'ancora aperti'}</span>` : ''))}${s.mtLate ? line('Controlli periodici scaduti', s.mtLate, 'bad') : ''}${s.attEx ? line('Attestati del personale scaduti', s.attEx, 'bad') : ''}</div>`

    + (s.serviziPers.length ? `<div class=card><b>Personale</b><div class=m>Servizi lavorati secondo i turni (doppio = 2)</div>${s.serviziPers.sort((a, b) => b.s - a.s).map(x => line(esc(x.n), `${x.s}${x.d ? ` <span class=m>(${x.d} doppi)</span>` : ''}`)).join('')}</div>` : '')

    + `<div class="m np" style="margin:0 2px 14px">I numeri vengono da ciò che la brigata registra in Brigata: più è completo, più il report è affidabile.</div>`;
}

function repText() {
  const s = repStats(repM), C = can('cost');
  const L = [`📋 Report di ${mName(repM)}${S.loc ? ' — ' + S.loc : ''}`, '',
    `Clienti serviti: ${s.serv} (${s.nServ} servizi, media ${s.avg})`,
    C && s.fcAvg != null ? `Food cost medio piatti: ${f1(s.fcAvg)}% · sopra target: ${s.over.length}` : '',
    `Scarti: ${s.sc.length} (buttati ${s.scB.length}${C && s.vB ? ', ' + eur(s.vB) : ''} · recuperati ${s.scR.length})`,
    s.invM ? `Inventario: ${C ? eur(s.invM.tot) : s.invM.r.length + ' prodotti'} (${dm(s.invM.d)})` : 'Inventario: non fatto',
    `Merce: ${s.rc.length} consegne controllate, ${s.rj.length} respinte`,
    `HACCP: ${s.log.length} letture, ${s.logBad.length} fuori range${s.covered != null ? `, ${s.covered}/${s.od} giorni completi` : ''}${s.cleanPct != null ? `, pulizie ${s.cleanPct}%` : ''}`,
    `Abbattimenti: ${s.ab.length}${s.abNc.length ? ` (${s.abNc.length} non conformi)` : ''} · Guasti: ${s.gu.length}${s.guOpen ? ` (${s.guOpen} aperti)` : ''}`,
    s.attEx ? `Attestati scaduti: ${s.attEx}` : ''];
  return L.filter(x => x !== '').join('\n');
}

Object.assign(A, {
  rpp: () => { repM = mAdd(repM || today().slice(0, 7), -1); draw(); },
  rpn: () => { if (repM < today().slice(0, 7)) { repM = mAdd(repM, 1); draw(); } },
  rps: () => shareText(repText())
});
