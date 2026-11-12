// Brigata — Profilo: pagina iniziale con la situazione di oggi
'use strict';

let peLoc = false, ip = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); ip = e; if (tab == 'pro') draw(); });
addEventListener('appinstalled', () => { ip = null; draw(); });
const isApp = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone;
const instCard = () => isApp() ? '' : `<div class=card><b>Installa Brigata</b>${ip ? '<div class=m style="margin:4px 0 8px">Aggiungila alla schermata home: si apre a schermo intero e funziona anche offline.</div><button data-a=inst>Installa app</button>' : '<div class=m style="margin-top:4px">Android (Chrome): menu ⋮ → Installa app. iPhone (Safari): Condividi → Aggiungi alla schermata Home.</div>'}</div>`;

function setLogo(f) {
  const im = new Image();
  im.onload = () => {
    const k = Math.min(1, 256 / Math.max(im.width, im.height)), c = document.createElement('canvas');
    c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
    c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
    S.logo = c.toDataURL(f.type == 'image/png' ? 'image/png' : 'image/jpeg', .85);
    save(); draw();
  };
  im.onerror = () => alert('Immagine non valida.');
  im.src = URL.createObjectURL(f);
}

function vF() {
  const D = today(), h = new Date().getHours(), E = can('edit');
  const td = S.pren.filter(x => x.d == D), tn = t => td.filter(x => x.t == t).reduce((a, x) => a + (x.p || 0), 0);
  const lg = S.log.filter(x => x.d == D), zr = S.u.filter(u => lg.some(x => x.u == u.id)).length, bad = lg.filter(x => !x.ok).length, tk = S.t.filter(t => S.done[D + t.id]).length;
  const LS = [...S.lots, ...S.pr.filter(x => x.e)], ex = LS.filter(x => days(x.e) < 0).length, sc = LS.filter(x => { const k = days(x.e); return k >= 0 && k <= 2; }).length;
  const lo = S.rec.filter(r => r.pv && cost(r) / r.s / r.pv * 100 > r.fc).length;
  const m30 = S.pren.filter(x => x.s != null && days(x.d) >= -30 && days(x.d) <= 0), tot = m30.reduce((a, x) => a + x.s, 0), g = tn('Giornaliera'), mx = Math.max(tn('Pranzo'), tn('Cena'), g);
  const scT = S.sc.filter(x => x.d == D), scM = S.sc.filter(x => x.d.slice(0, 7) == D.slice(0, 7));
  const prW = S.pr.filter(x => x.e && days(x.e) <= 2).length;
  const row = (l, val, to, c) => `<div class=row data-a=tab data-id=${to} style="padding:10px 0;border-top:1px solid var(--b);cursor:pointer"><span>${l}</span><b class="${c || ''}">${val}</b></div>`;
  return bcTiles()
    + `<div class=card ${E ? 'data-a=xpe style="text-align:center;cursor:pointer"' : 'style="text-align:center"'}>${S.logo ? `<img src="${S.logo}" alt="" style="height:88px;max-width:100%;object-fit:contain">` : ''}<div style="font:700 22px Georgia,serif;margin-top:6px">${esc(S.loc || 'Il tuo locale')}</div><div class=m>${h < 12 ? 'Buongiorno' : h < 18 ? 'Buon pomeriggio' : 'Buonasera'}${me() ? ' ' + esc(me().split(' ')[0]) : ''} · ${new Date().toLocaleDateString('it', {weekday:'long', day:'numeric', month:'long'})}</div>${E && !peLoc && S.loc ? '<div class=m style="font-size:12px;margin-top:4px;opacity:.8">Tocca per modificare nome e logo</div>' : ''}</div>`
    + ((peLoc || !S.loc) && E ? `<div class=card><b>Il tuo locale</b><input id=loc placeholder="Nome del locale" value="${esc(S.loc)}"><input id=cap type=number min=0 inputmode=numeric placeholder="Posti a sedere (facoltativo)" value="${S.cap || ''}"><div class="row st" style="margin-top:8px"><button data-a=ul>${S.logo ? 'Cambia logo' : 'Carica logo'}</button>${S.logo ? '<button class="g d" data-a=rl>Rimuovi</button>' : ''}</div><input type=file id=lg accept="image/*" hidden><div class=m style="margin-top:6px">Il logo compare in alto, sulla tabella allergeni e sul menù digitale.</div><button data-a=xpd class=w style="margin-top:12px">Fatto</button></div>` : '')
    + (Cloud.on && !Cloud.user && localStorage.getItem('br_last') ? `<div class="card memo"><b>Sei uscito dall'account</b><div class=m style="margin:4px 0 8px">Qui vedi solo i dati salvati su questo telefono. Accedi per ritrovare quelli di ${esc(localStorage.getItem('br_last'))}.</div><button data-a=tab data-id=stf>Accedi</button></div>` : '')
    + (Cloud.on && !Cloud.rid && !Cloud.user && !localStorage.getItem('br_last') ? `<div class=card style="border-color:var(--g)"><b>Lavora in squadra</b><div class=m style="margin:4px 0 8px">Crea l'account del ristorante: tutta la brigata vede gli stessi dati dal proprio telefono, anche offline.</div><button data-a=tab data-id=stf>Vai a Staff</button></div>` : '')
    + instCard()
    + `<div class=card><b>Situazione di oggi</b><div class=m style="margin-bottom:6px">Tocca una riga per aprire la sezione.</div>`
    + row('Prenotazioni', `Pranzo ${tn('Pranzo')} · Cena ${tn('Cena')}${g ? ` · Giorn. ${g}` : ''}${S.cap ? ` · posti ${S.cap}` : ''}`, 'pre', S.cap && mx > S.cap ? 'bad' : '')
    + row('Temperature registrate', S.u.length ? `${zr}/${S.u.length}${bad ? ` · ${bad} fuori range` : ''}` : '–', 'hac', bad ? 'bad' : zr < S.u.length ? 'warn' : '')
    + row('Pulizie fatte', S.t.length ? `${tk}/${S.t.length}` : '–', 'hac')
    + row('Scadenze', ex || sc ? `${ex ? ex + ' scaduti' : ''}${ex && sc ? ' · ' : ''}${sc ? sc + ' in scadenza' : ''}` : 'tutto ok', 'hac', ex ? 'bad' : sc ? 'warn' : '')
    + row('Magazzino', S.pr.length ? `${S.pr.length} prodotti${prW ? ` · ${prW} in scadenza` : ''}${S.sp.filter(x => !x.ok).length ? ` · ${S.sp.filter(x => !x.ok).length} da ordinare` : ''}` : '–', 'mag', prW ? 'warn' : '')
    + row('Scarti', `oggi ${scT.length} · mese ${scM.length}`, 'sca')
    + (E && S.att.length ? (() => { const a = attStat(); return row('Attestati del personale', a.ex || a.soon ? `${a.ex ? a.ex + (a.ex == 1 ? ' scaduto' : ' scaduti') : ''}${a.ex && a.soon ? ' · ' : ''}${a.soon ? a.soon + ' in scadenza' : ''}` : 'tutti validi', 'att', a.ex ? 'bad' : a.soon ? 'warn' : ''); })() : '')
    + (can('cost') ? row('Piatti sopra il food cost target', lo, 'rec', lo ? 'bad' : '') : '')
    + row('Clienti serviti, ultimi 30 giorni', `${tot}${m30.length ? ` · ${m30.length} servizi` : ''}`, 'pre')
    + `</div>`
    + (E ? `<div class=card><b>Messaggio per la brigata</b><textarea id=memo rows=4 placeholder="Da ordinare, da ricordare, note per la brigata…">${esc(S.memo || '')}</textarea><div class=m style="margin-top:6px">Compare in Bacheca come messaggio dello chef per i cuochi.</div></div>` : '')
    + (E ? `<div class=card><b>Backup</b><div class=m>${Cloud.rid ? 'I dati sono salvati online e su questo telefono. Puoi comunque esportare una copia.' : 'I dati restano in questo dispositivo. Esporta un file per sicurezza o per spostarli.'}</div><div class=row style="margin-top:8px"><button data-a=exp>Esporta</button>${!Cloud.rid || role() == 'owner' ? '<button class=g data-a=imp>Importa</button>' : ''}</div></div>` : '')
    + `<div class="card m">Allergeni e temperature sono strumenti di registrazione: non sostituiscono il piano HACCP del locale né la lettura delle etichette.</div>`;
}

function importBackup(file) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const x = JSON.parse(r.result);
      if (!x || typeof x != 'object' || !Array.isArray(x.ing) || !Array.isArray(x.rec)) throw 0;
      const msg = Cloud.rid ? 'Sostituire TUTTI i dati del ristorante con il backup? La modifica arriva anche ai telefoni della brigata.' : 'Sostituire i dati attuali con il backup?';
      if (!confirm(msg)) return;
      if (Cloud.rid) Cloud.allowMass = true;   // sostituzione voluta: le cancellazioni vanno inviate
      S = norm(x); save(); act('backup', 'Dati sostituiti da un backup'); draw(); tst('Backup importato');
    } catch (_) { alert('File non valido.'); }
  };
  r.readAsText(file);
}

Object.assign(A, {
  xpe: () => { peLoc = true; draw(); }, xpd: () => { peLoc = false; draw(); },
  inst: () => { ip.prompt(); ip.userChoice.then(() => { ip = null; draw(); }); },
  ul: () => $('#lg').click(), rl: () => { S.logo = null; save(); draw(); },
  exp: () => { const a = document.createElement('a'); const o = {...S}; a.href = URL.createObjectURL(new Blob([JSON.stringify(o)], {type:'application/json'})); a.download = 'brigata-' + today() + '.json'; a.click(); },
  imp: () => $('#f').click()
});

document.addEventListener('change', e => {
  const t = e.target, i = t.id;
  if (i == 'loc') { S.loc = t.value.trim(); save(); hdr(); }
  if (i == 'cap') { S.cap = +t.value || 0; save(); }
  if (i == 'memo') { S.memo = t.value; S.memoD = today(); save(); }
  if (i == 'lg' && t.files[0]) { setLogo(t.files[0]); t.value = ''; }
  if (i == 'f' && t.files[0]) { importBackup(t.files[0]); t.value = ''; }
});
