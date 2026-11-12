// Brigata — cottura e abbattimento della temperatura
// Si registra la temperatura al cuore a fine cottura, si avvia l'abbattimento e Brigata
// conta il tempo; a fine ciclo si scrive la temperatura raggiunta e la preparazione
// può andare subito in magazzino.
'use strict';

// riferimenti indicativi (verifica con il tuo piano HACCP)
const ABT = {
  p: {l:'Positivo', tf:10, min:90, d:'fino a +10 °C al cuore entro 90 minuti'},
  n: {l:'Negativo', tf:-18, min:240, d:'fino a −18 °C al cuore entro 4 ore'}
};
const AB_CORE = 75;   // temperatura al cuore di riferimento a fine cottura
const abRun = () => S.ab.filter(a => !a.e).sort((a, b) => a.s.localeCompare(b.s));
const abMin = a => Math.round(((a.e ? new Date(a.e) : new Date()) - new Date(a.s)) / 60000);
const abLeft = a => ABT[a.ty].min - abMin(a);
const hhmm = iso => new Date(iso).toLocaleTimeString('it', {hour:'2-digit', minute:'2-digit'});

function abStart() {
  const names = [...new Set([...S.pp.map(x => x.n), ...S.rec.map(r => r.n)])].sort((a, b) => a.localeCompare(b));
  ed('Avvia abbattimento',
    `<input name=n list=abl placeholder="Preparazione (es. Ragù, Brodo, Arrosto)"><datalist id=abl>${names.map(t => `<option value="${esc(t)}">`).join('')}</datalist>
     <input name=tc type=number step=0.1 inputmode=decimal placeholder="Temperatura al cuore a fine cottura °C">
     <div class=hint id=abh>Riferimento indicativo: almeno ${AB_CORE} °C al cuore.</div>
     <div class=sg style="margin:10px 0 4px"><button type=button data-ty=p class=on>Positivo</button><button type=button data-ty=n>Negativo</button></div>
     <div class=m id=abd>${ABT.p.d}</div>
     <input name=x placeholder="Note (quantità, teglie…)" style="margin-top:8px">`,
    d => {
      const n = v(d, 'n').trim(), tc = v(d, 'tc');
      if (!n) { alert('Scrivi la preparazione.'); return false; }
      if (tc !== '' && num(tc) < AB_CORE && !confirm(`Temperatura al cuore sotto ${AB_CORE} °C. Avviare comunque l'abbattimento?`)) return false;
      const ty = d.querySelector('[data-ty].on').dataset.ty;
      S.ab.push({id:uid(), n, d:today(), s:new Date().toISOString(), tc:tc === '' ? null : num(tc), ty, e:'', tf:null, ok:null, by:me(), x:v(d, 'x').trim()});
      act('abbattimento', `Avviato ${ABT[ty].l.toLowerCase()}: ${n}${tc !== '' ? ' · cuore ' + num(tc) + '°' : ''}`);
      abNotifyPerm();
    });
  const D = $('#d');
  D.querySelectorAll('[data-ty]').forEach(b => b.onclick = () => { D.querySelectorAll('[data-ty]').forEach(o => o.classList.toggle('on', o == b)); $('#abd').textContent = ABT[b.dataset.ty].d; });
  D.querySelector('[name=tc]').oninput = e => { const t = e.target.value; $('#abh').innerHTML = t === '' ? `Riferimento indicativo: almeno ${AB_CORE} °C al cuore.` : num(t) >= AB_CORE ? '<span class=ok>Cottura nel riferimento</span>' : `<span class=warn>Sotto i ${AB_CORE} °C di riferimento</span>`; };
}

function abEnd(id) {
  const a = S.ab.find(x => x.id == id); if (!a) return;
  const T = ABT[a.ty], mins = abMin(a);
  ed('Fine abbattimento · ' + esc(a.n),
    `<div class=m>Avviato alle ${hhmm(a.s)} · ${mins} minuti fa · ${T.l.toLowerCase()} (${T.d})</div>
     <input name=tf type=number step=0.1 inputmode=decimal placeholder="Temperatura al cuore raggiunta °C">
     <div class=hint id=abeh></div>
     <input name=x placeholder="Azione correttiva (se non conforme)" value="">
     <label class=chk><input type=checkbox name=mg checked>Poi mettila in magazzino come preparazione</label>`,
    d => {
      const raw = v(d, 'tf'); if (raw === '') { alert('Scrivi la temperatura raggiunta.'); return false; }
      const tf = num(raw), ok = tf <= T.tf && mins <= T.min;
      if (!ok && !v(d, 'x').trim()) { alert('Abbattimento non conforme: scrivi l\'azione correttiva.'); return false; }
      Object.assign(a, {e:new Date().toISOString(), tf, ok, x:[a.x, v(d, 'x').trim()].filter(Boolean).join(' · ')});
      act('abbattimento', `${a.n}: ${tf}° in ${mins} min${ok ? '' : ' NON CONFORME'}`);
      if (d.querySelector('[name=mg]').checked) {
        const cong = a.ty == 'n' ? S.fr.find(f => f.k == 'cong') : null;
        setTimeout(() => ePrep(null, cong ? cong.id : '', 1, a.n), 80);
      }
    });
  $('#d [name=tf]').oninput = e => { const t = e.target.value; $('#abeh').innerHTML = t === '' ? '' : num(t) <= T.tf && mins <= T.min ? '<span class=ok>Conforme</span>' : `<span class=bad>Non conforme${mins > T.min ? ` (oltre i ${T.min} minuti)` : ''}: scrivi l'azione correttiva</span>`; };
  setTimeout(() => { const i = $('#d [name=tf]'); if (i) i.focus(); }, 50);
}

function abCard() {
  const R = abRun(), today_ = S.ab.filter(a => a.e && a.d == today());
  return `<div class="card np"><div class=row><b>Cottura e abbattimento</b><button class=sm data-a=abn>Avvia</button></div>`
    + R.map(a => { const left = abLeft(a); return `<div class=li><div class=row><div><b>${esc(a.n)}</b><div class=m>${ABT[a.ty].l} · dalle ${hhmm(a.s)}${a.tc != null ? ` · cuore ${a.tc}°` : ''}</div></div><button data-a=abe data-id=${a.id}>Fine</button></div><div class="${left < 0 ? 'bad' : left <= 10 ? 'warn' : 'm'}" style="margin-top:4px;font-weight:700">${left < 0 ? `tempo superato di ${-left} min` : `${left} min rimasti`}</div><div class=bar><i style="width:${Math.min(100, Math.round(abMin(a) / ABT[a.ty].min * 100))}%;${left < 0 ? 'background:var(--r)' : ''}"></i></div></div>`; }).join('')
    + (today_.length ? `<div class=m style="margin-top:8px">Oggi: ${today_.map(a => `${esc(a.n)} <span class="${a.ok ? '' : 'bad'}">${a.tf}° in ${abMin(a)} min</span>`).join(' · ')}</div>` : '')
    + (!R.length && !today_.length ? '<div class=m style="margin-top:6px">Registra la temperatura al cuore e avvia il timer quando metti una preparazione nell\'abbattitore.</div>' : '')
    + `</div>`;
}

const abTable = L => `<tr><th>Data</th><th>Preparazione</th><th>Cuore</th><th>Tipo</th><th>Durata</th><th>Fine</th><th>Chi</th></tr>`
  + (L.map(a => `<tr><td>${dm(a.d)} ${hhmm(a.s)}</td><td>${esc(a.n)}${a.x ? `<div class=m>${esc(a.x)}</div>` : ''}</td><td class="${a.tc != null && a.tc < AB_CORE ? 'warn' : ''}">${a.tc != null ? a.tc + '°' : '–'}</td><td>${ABT[a.ty].l}</td><td>${a.e ? abMin(a) + ' min' : 'in corso'}</td><td class="${a.ok === false ? 'bad' : ''}">${a.tf != null ? a.tf + '°' : '–'}${a.ok === false ? ' NC' : ''}</td><td class=m>${esc(a.by || '')}</td></tr>`).join('')
  || '<tr><td colspan=7 class=m>Nessun abbattimento in questo mese.</td></tr>');

// Avvisi mentre l'app è aperta (anche in secondo piano se il telefono lo permette)
const abWarned = new Set();
function abNotifyPerm() { try { if ('Notification' in window && Notification.permission == 'default') Notification.requestPermission(); } catch (e) {} }
function abTick() {
  if (!S || !S.ab) return;
  const R = abRun();
  R.forEach(a => {
    const left = abLeft(a);
    [[10, 'mancano 10 minuti'], [0, 'tempo scaduto: misura la temperatura']].forEach(([k, msg]) => {
      const key = a.id + ':' + k;
      if (left <= k && !abWarned.has(key)) {
        abWarned.add(key);
        if (left < k - 15) return;   // avviso vecchio: non disturbare
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        tst(`Abbattimento ${a.n}: ${msg}`);
        try {
          if ('Notification' in window && Notification.permission == 'granted') {
            const t = 'Brigata · ' + a.n, o = {body:'Abbattimento: ' + msg, icon:'icon-192.png', tag:key};
            if (navigator.serviceWorker && navigator.serviceWorker.controller) navigator.serviceWorker.ready.then(r => r.showNotification(t, o)); else new Notification(t, o);
          }
        } catch (e) {}
      }
    });
  });
  if (R.length && (tab == 'hac' || tab == 'pro')) refresh();
}
setInterval(abTick, 30000);
setTimeout(abTick, 2000);

const abBanner = () => {
  const R = abRun(); if (!R.length) return '';
  return `<div class="card memo" data-a=abgo style="cursor:pointer"><div class=kick>Abbattimento in corso</div>${R.map(a => { const l = abLeft(a); return `<div class=row style="margin-top:4px"><span>${esc(a.n)}</span><b class="${l < 0 ? 'bad' : l <= 10 ? 'warn' : ''}">${l < 0 ? 'scaduto da ' + -l + ' min' : l + ' min'}</b></div>`; }).join('')}</div>`;
};

Object.assign(A, {abn: () => abStart(), abe: id => abEnd(id), abgo: () => { tab = 'hac'; hS = 'oggi'; draw(); }});
