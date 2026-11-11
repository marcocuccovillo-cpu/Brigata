// Brigata — Bacheca: tavolate a menù fisso, note dei cuochi, messaggio dello chef
'use strict';

const bcDay = d => new Date(d + 'T12:00');
const ntSort = (a, b) => (b.i || 0) - (a.i || 0) || b.d.localeCompare(a.d) || String(b.id).localeCompare(String(a.id));

const tvTile = (t, small) => {
  const dt = bcDay(t.d);
  return `<div class=t data-a=xtv data-id=${t.id}><div class=h>${dt.toLocaleDateString('it', {weekday:'short'})} · ${dt.toLocaleDateString('it', {month:'short'})}<div class=dn>${dt.getDate()}</div></div><div class=b><b class=clamp>${esc(t.n)}</b><div class=m${small ? ' style="font-size:11px"' : ''}>${t.p} persone${t.pr && can('cost') ? ` · ${eur(t.pr)}` : ''}</div>${t.dl == 'cli' ? '<div class=sc>Scontrino pasticceria</div>' : ''}</div></div>`;
};
const ntTile = t => `<div class="t n${t.i ? ' imp' : ''}" data-a=xnt data-id=${t.id}><div class=h>${esc(t.a || 'Nota')}<div style="font-weight:400;opacity:.8">${fd(t.d)}</div></div><div class=b><div class=clamp style="-webkit-line-clamp:6">${esc(t.x)}</div></div></div>`;

// riquadri in sola lettura per il Profilo
function bcTiles() {
  const D = today(), tv = S.tv.filter(x => x.d >= D).sort((a, b) => a.d.localeCompare(b.d)), nt = [...S.nt].sort(ntSort).slice(0, 12);
  const hd = `<div class=row style="margin:2px 2px 6px"><b style="font:700 18px Georgia,serif">Bacheca</b><button class="g sm" data-a=tab data-id=bac>Apri</button></div>`;
  if (!tv.length && !nt.length) return hd + '<div class=empty>Nessun menù fisso in programma né note dei cuochi.</div>';
  return hd + `<div class=tl>${tv.map(t => tvTile(t)).join('')}${nt.map(ntTile).join('')}</div>`;
}

function vBac() {
  const D = today(), tv = S.tv.filter(x => x.d >= D).sort((a, b) => a.d.localeCompare(b.d)), past = S.tv.filter(x => x.d < D).sort((a, b) => b.d.localeCompare(a.d)).slice(0, 10), nt = [...S.nt].sort(ntSort), memo = (S.memo || '').trim();
  return `<div class="row st" style="margin-bottom:6px"><button data-a=xbt>+ Tavolata</button><button data-a=xbn>+ Nota</button></div>`
    + (memo ? `<div class="card memo" style="margin-top:10px"><div class=kick>Messaggio dello chef${S.memoD ? ' · ' + dm(S.memoD) : ''}</div><div style="white-space:pre-wrap;margin-top:6px">${esc(memo)}</div></div>` : '')
    + `<h3 class=sub>Tavolate</h3>` + (tv.length ? `<div class="tl sm">${tv.map(t => tvTile(t, 1)).join('')}</div>` : '<div class=empty>Nessuna tavolata in programma.</div>')
    + (past.length ? `<div class=m style="margin:10px 2px 4px">Tavolate passate</div>` + past.map(t => `<div class="card row" data-a=xtv data-id=${t.id} style="padding:8px 10px;margin-bottom:6px;cursor:pointer"><span>${fd(t.d)} · ${esc(t.n)}</span><span class=m>${t.p} pers.</span></div>`).join('') : '')
    + `<h3 class=sub>Note dei cuochi</h3>` + (nt.length ? `<div class="tl sm">${nt.map(ntTile).join('')}</div>` : '<div class=empty>Nessuna nota dei cuochi.</div>')
    + `<div class=m style="margin:10px 2px">Tocca un riquadro per i dettagli.${Cloud.rid ? '' : ' Senza account la bacheca resta su questo dispositivo: collega il ristorante da Staff per condividerla con la brigata.'}</div>`;
}

function bcEN(id) {
  const n = !id, t = S.nt.find(x => x.id == id) || {id:uid(), a:me(), x:'', d:today(), i:0};
  ed(n ? 'Nuova nota' : 'Nota',
    `<input name=a placeholder="Chi scrive (es. Marco)" value="${esc(t.a)}"><textarea name=x rows=5 placeholder="Nota per la brigata…">${esc(t.x)}</textarea><label class=chk><input type=checkbox name=i ${t.i ? 'checked' : ''}>Importante</label>`,
    d => {
      if (!v(d, 'x').trim()) return false;
      if (!Cloud.rid && v(d, 'a').trim()) S.me = v(d, 'a').trim();
      Object.assign(t, {a:v(d, 'a').trim(), x:v(d, 'x').trim(), i:d.querySelector('[name=i]').checked ? 1 : 0});
      if (n) { S.nt.push(t); act('nota', t.x.slice(0, 80)); }
    });
}

function bcET(id) {
  const n = !id, t = S.tv.find(x => x.id == id) || {id:uid(), n:'', d:today(), p:'', m:'', dl:'casa', dd:'', pr:'', nt:''};
  ed(n ? 'Nuova tavolata' : 'Tavolata',
    `<input name=n placeholder="Nome / occasione (es. Compleanno Rossi)" value="${esc(t.n)}">
     <div class=row><input name=d type=date value="${t.d}"><input name=p type=number min=1 inputmode=numeric placeholder="Persone" value="${t.p}"></div>
     ${can('cost') ? `<input name=pr type=number step=0.5 inputmode=decimal placeholder="Prezzo a persona €" value="${t.pr || ''}">` : ''}
     <div class=m>Menù fisso (anche piatti fuori carta)</div><textarea name=m rows=5 placeholder="Antipasti, primi, secondi…">${esc(t.m)}</textarea>
     <div class=m>Dolce</div><select name=dl><option value=casa ${t.dl == 'casa' ? 'selected' : ''}>Dolci della casa</option><option value=cli ${t.dl == 'cli' ? 'selected' : ''}>Portano il loro dolce</option></select>
     <textarea name=dd rows=2 placeholder="Quali dolci della casa (se scelti)">${esc(t.dd)}</textarea>
     <input name=nt placeholder="Note (allergie, orari, torta…)" value="${esc(t.nt)}">`,
    d => {
      if (!v(d, 'n').trim() || !v(d, 'd') || !(+v(d, 'p') > 0)) { alert('Scrivi nome, data e numero di persone.'); return false; }
      Object.assign(t, {n:v(d, 'n').trim(), d:v(d, 'd'), p:+v(d, 'p'), m:v(d, 'm').trim(), dl:v(d, 'dl'), dd:v(d, 'dd').trim(), nt:v(d, 'nt').trim()});
      if (can('cost')) t.pr = num(v(d, 'pr'));
      if (n) { S.tv.push(t); act('tavolata', `${t.n} · ${fd(t.d)} · ${t.p} persone`); }
      if (t.dl == 'cli') setTimeout(() => alert('Ricorda: chiedi lo scontrino della pasticceria.'), 60);
    });
}

function bcDet(h, fe, fx) {
  const D = $('#d');
  D.innerHTML = h + `<div class=row style="margin-top:14px"><button class="g d" type=button id=dx>Elimina</button><button class=g type=button id=de>Modifica</button><button type=button id=dc>Chiudi</button></div>`;
  D.showModal();
  $('#dc').onclick = () => D.close();
  $('#de').onclick = () => fe();
  $('#dx').onclick = () => { if (confirm('Eliminare?')) { fx(); save(); D.close(); } };
}

function bcDTv(id) {
  const t = S.tv.find(x => x.id == id); if (!t) return;
  const C = can('cost') && t.pr;
  bcDet(`<h3 style="margin:0 0 4px">${esc(t.n)}</h3><div>${bcDay(t.d).toLocaleDateString('it', {weekday:'long', day:'numeric', month:'long', year:'numeric'})}</div><div class=m>${t.p} persone${C ? ` · ${eur(t.pr)} a persona · totale ${eur(t.pr * t.p)}` : ''}</div>
    <div class=m style="margin-top:12px">Menù fisso</div><div style="white-space:pre-wrap">${esc(t.m) || '–'}</div>
    <div class=m style="margin-top:12px">Dolce</div>${t.dl == 'cli' ? '<div class=card style="background:var(--s);border-color:var(--g);margin:6px 0 0"><b>Portano il loro dolce</b><div>Ricorda di chiedere lo scontrino della pasticceria.</div></div>' : `<div style="white-space:pre-wrap">Dolci della casa${t.dd ? ': ' + esc(t.dd) : ''}</div>`}
    ${t.nt ? `<div class=m style="margin-top:12px">Note</div><div style="white-space:pre-wrap">${esc(t.nt)}</div>` : ''}`,
    () => bcET(id), () => { S.tv = S.tv.filter(x => x.id != id); });
}

function bcDNt(id) {
  const t = S.nt.find(x => x.id == id); if (!t) return;
  bcDet(`<div class=m>${esc(t.a || 'Nota')} · ${fd(t.d)}${t.i ? ' · <b class=warn>importante</b>' : ''}</div><div style="white-space:pre-wrap;margin-top:8px;font-size:17px">${esc(t.x)}</div>`,
    () => bcEN(id), () => { S.nt = S.nt.filter(x => x.id != id); });
}

Object.assign(A, {xbn: () => bcEN(), xbt: () => bcET(), xtv: id => bcDTv(id), xnt: id => bcDNt(id)});
