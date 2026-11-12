// Brigata — Staff: account, ristorante, brigata, inviti, sincronizzazione e registro attività
'use strict';

let auMode = 'in', auErr = '', auBusy = false, actF = 'all', auCode = '', auEm = '', auNm = '', auPw = '';
const ACTK = {temp:'Temperatura', pulizia:'Pulizia', lotto:'Lotto', merce:'Merce', scarto:'Scarto', pren:'Servizio', tavolata:'Tavolata', nota:'Nota', ricetta:'Ricetta', turni:'Turni', menu:'Menù', team:'Brigata', backup:'Backup'};
const ACTF = [['all','Tutto'],['haccp','HACCP'],['merce','Merce e scarti'],['altro','Altro']];
const actIn = (a, f) => f == 'all' || (f == 'haccp' ? ['temp','pulizia','lotto'].includes(a.kind) : f == 'merce' ? ['merce','scarto'].includes(a.kind) : !['temp','pulizia','lotto','merce','scarto'].includes(a.kind));

function syncLine() {
  const C = Cloud, n = C.pending;
  const st = {ok:'Sincronizzato', run:'Sincronizzazione…', offline:'Offline: i dati sono salvati sul telefono', err:'Errore: ' + C.err, idle:'In attesa'}[C.state] || '';
  return `${st}${n ? ` · ${n} modifiche da inviare` : ''}${C.last && C.state != 'run' ? ` · ultimo invio ${ago(C.last)}` : ''}`;
}

function badge() {
  const b = $('#sync');
  if (!b) return;
  if (!Cloud.rid) { b.style.display = 'none'; return; }
  const s = Cloud.state;
  b.style.display = '';
  b.className = 'sync' + (s == 'run' ? ' run' : s == 'offline' || !Cloud.sess ? ' off' : s == 'err' ? ' err' : '');
  b.innerHTML = `<i></i>${s == 'run' ? 'sync' : s == 'offline' ? 'offline' : s == 'err' || !Cloud.sess ? 'errore' : Cloud.pending ? Cloud.pending + ' da inviare' : 'ok'}`;
  b.title = syncLine();
  const sl = $('#syncl'); if (sl) sl.textContent = syncLine();
}

function vStf() {
  const C = Cloud;
  if (!C.on) return `<div class=card><b>Account non ancora attivo</b><div class=m style="margin-top:6px">Per lavorare in squadra Brigata usa un database Supabase. Chi installa l'app deve inserire indirizzo e chiave del progetto nel file <b>config.js</b> (le istruzioni sono nel file LEGGIMI).</div><div class=m style="margin-top:8px">Intanto Brigata funziona solo su questo telefono.</div></div>` + rolesCard();
  if (!C.user) return authCard();
  if (!C.rid) return noRestCard();
  if (tab == 'stf') {
    C.loadTeam().then(ch => { if (ch) refresh(); }).catch(() => {});
    C.loadActs().then(ch => { if (ch) refresh(); }).catch(() => {});
  }
  const own = role() == 'owner', M = C.members, mine = C.user.id;
  const others = C.list.filter(x => x.restaurant_id != C.rid);
  const acts = (C.m.acts || []).filter(a => actIn(a, actF));
  let lastD = '';
  return `<div class=card><div class=row><div><b style="font:700 19px Georgia,serif">${esc(C.rname || S.loc)}</b><div class=m id=syncl>${syncLine()}</div></div><button class="g sm" data-a=ssy>Sincronizza</button></div></div>`
    + `<div class=card><b>Tu</b><div class=row style="margin-top:8px"><div><div>${esc(C.name || '—')} <span class="role ${role()}">${ROLES[role()]}</span></div><div class=m>${esc(C.user.email)}</div></div><button class="g sm" data-a=sme>Nome</button></div>`
    + (others.length ? `<div class=m style="margin-top:10px">Altri ristoranti</div>${others.map(x => `<div class=row style="margin-top:6px"><span>${esc(x.name)} <span class="role ${x.role}">${ROLES[x.role]}</span></span><button class="g sm" data-a=sgo data-id=${x.restaurant_id}>Apri</button></div>`).join('')}` : '')
    + `<div class="row st" style="margin-top:12px"><button class=g data-a=snew>+ Altro ristorante</button><button class="g d" data-a=sout>Esci</button></div></div>`
    + `<div class=card><b>La brigata</b>${M ? M.map(x => `<div class=li><div class=row ${own && x.user_id != mine ? `data-a=smem data-id=${x.user_id} style="cursor:pointer"` : ''}><span>${esc(x.name || 'Senza nome')}${x.user_id == mine ? ' <span class=m>(tu)</span>' : ''}</span><span class="role ${x.role}">${ROLES[x.role]}</span></div></div>`).join('') : '<div class=m style="margin-top:6px">Caricamento…</div>'}${own ? '<div class=hint>Tocca una persona per cambiarle il ruolo o toglierla dalla brigata.</div>' : ''}</div>`
    + (can('invite') ? `<div class=card><b>Invita nella brigata</b><div class=m style="margin:4px 0 8px">Genera un codice e mandalo su WhatsApp: chi lo riceve crea il suo account e lo inserisce. Vale 7 giorni.</div><div class="row st"><button data-a=sinv data-id=cook>Codice per un cuoco</button>${own ? '<button class=g data-a=sinv data-id=manager>Per un responsabile</button>' : ''}</div>
       ${C.invites && C.invites.length ? `<div class=m style="margin-top:12px">Codici attivi</div>${C.invites.filter(i => new Date(i.expires_at) > new Date()).map(i => `<div class=row style="margin-top:6px"><span><b style="font-family:ui-monospace,monospace;letter-spacing:2px">${i.code}</b> <span class=m>${ROLES[i.role].toLowerCase()} · usato ${i.uses} · scade ${new Date(i.expires_at).toLocaleDateString('it')}</span></span><span class=row style="gap:4px"><button class="g sm" data-a=sshr data-id=${i.code} data-r=${i.role}>Invia</button><button class="g d sm" data-a=sdi data-id=${i.code}>✕</button></span></div>`).join('')}` : ''}</div>` : '')
    + `<div class=card><div class=row><b>Registro attività</b><button class="g sm np" data-a=print>Stampa</button></div><div class=m style="margin-top:2px">Chi ha registrato cosa e quando. Non si può modificare.</div>
       <div class="sg np" style="margin:10px 0 4px">${ACTF.map(([k, l]) => `<button data-a=saf data-id=${k} class="${k == actF ? 'on' : ''}">${l}</button>`).join('')}</div>
       ${acts.slice(0, 150).map(a => { const d = a.at.slice(0, 10), loc = new Date(a.at), dd = loc.toLocaleDateString('sv'), h = dd != lastD ? `<div class=m style="margin:12px 0 2px"><b>${fd(dd)}</b></div>` : ''; lastD = dd; return h + `<div class=act><div class=w>${loc.toLocaleTimeString('it', {hour:'2-digit', minute:'2-digit'})}</div><div style="flex:1;min-width:0"><div class=k>${ACTK[a.kind] || esc(a.kind)}${a.local ? ' · da inviare' : ''}</div><div>${esc(a.text)}</div><div class=m style="font-size:12px">${esc(a.user_name)}</div></div></div>`; }).join('') || '<div class=m style="margin-top:8px">Ancora nessuna attività.</div>'}</div>`
    + rolesCard();
}

const rolesCard = () => `<div class="card np"><b>Chi può fare cosa</b><table style="margin-top:6px"><tr><th></th><th>Titolare</th><th>Resp.</th><th>Cuoco</th></tr>
  ${[['Temperature, pulizie, lotti, scarti','✓','✓','✓'],['Magazzino, ordini, bacheca, prenotazioni','✓','✓','✓'],['Ricette e allergeni (vedere)','✓','✓','✓'],['Prezzi, food cost, margini','✓','✓','—'],['Ricette, zone, turni (modificare)','✓','✓','—'],['Invitare cuochi','✓','✓','—'],['Ruoli e responsabili','✓','—','—']].map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td></tr>`).join('')}</table></div>`;

function authCard() {
  const up = auMode == 'up', last = localStorage.getItem('br_last');
  return (last && !up ? `<div class="card memo"><b>Sei uscito dall'account</b><div class=m style="margin-top:4px">Accedi per ritrovare i dati di ${esc(last)}.</div></div>` : '') + `<div class=card><div class=sg>${[['in','Accedi'],['up','Crea account']].map(([k, l]) => `<button data-a=sau data-id=${k} class="${k == auMode ? 'on' : ''}">${l}</button>`).join('')}</div>
    <form id=auf onsubmit="return false">${up ? `<input name=nm autocomplete=name placeholder="Il tuo nome (es. Marco)" value="${esc(auNm)}">` : ''}<input name=em type=email autocomplete=email autocapitalize=none spellcheck=false placeholder="Email" value="${esc(auEm)}">
    <div class=row style="gap:6px"><input name=pw type=password autocomplete="${up ? 'new-password' : 'current-password'}" autocapitalize=none spellcheck=false placeholder="Password${up ? ' (almeno 6 caratteri)' : ''}" value="${esc(auPw)}"><button type=button class="g sm" data-a=spw style="flex:none">Mostra</button></div>
    ${auErr ? `<div class=err>${esc(auErr)}${auCode == 'email_not_confirmed' ? '<div style="margin-top:6px"><button type=button class="g sm" data-a=srs>Rimanda email di conferma</button></div>' : ''}</div>` : ''}<button data-a=sgo2 class=w style="margin-top:8px" ${auBusy ? 'disabled' : ''}>${auBusy ? 'Attendi…' : up ? 'Crea account' : 'Accedi'}</button></form>
    ${up ? '' : '<button type=button class=g data-a=sfp style="margin-top:8px;border:0;padding:6px 0;text-decoration:underline;color:var(--a)">Password dimenticata?</button>'}
    <div class=m style="margin-top:10px">${up ? 'Il titolare crea l\'account e poi il ristorante; i cuochi creano l\'account e inseriscono il codice ricevuto.' : 'Senza account Brigata funziona solo su questo telefono.'}</div></div>` + rolesCard();
}

function noRestCard() {
  const C = Cloud, hasLocal = !!(S.rec.length || S.ing.length || S.log.length || S.pr.length || S.loc);
  return `<div class=card><b>Ciao ${esc(C.user.name || C.user.email)}</b><div class=m>Crea il tuo ristorante o entra in quello dove lavori.</div></div>`
    + (C.list.length ? `<div class=card><b>I tuoi ristoranti</b>${C.list.map(x => `<div class=row style="margin-top:8px"><span>${esc(x.name)} <span class="role ${x.role}">${ROLES[x.role]}</span></span><button class=sm data-a=sgo data-id=${x.restaurant_id}>Apri</button></div>`).join('')}</div>` : '')
    + `<div class=card><b>Entra con un codice</b><div class=m>Il titolare o il responsabile ti manda un codice di 6 caratteri.</div><input id=jc placeholder="Codice (es. K7M2QX)" autocapitalize=characters maxlength=6 style="text-transform:uppercase;letter-spacing:3px;font-weight:700"><input id=jn placeholder="Il tuo nome nella brigata" value="${esc(C.user.name || '')}"><button data-a=sjoin class=w style="margin-top:6px">Entra nella brigata</button></div>`
    + `<div class=card><b>Crea il tuo ristorante</b><div class=m>Diventi titolare: poi inviti la brigata.</div><input id=rn placeholder="Nome del locale" value="${esc(S.loc)}"><input id=rm placeholder="Il tuo nome" value="${esc(C.user.name || S.me || '')}">${hasLocal ? '<label class=chk><input type=checkbox id=rs checked>Porta nel ristorante i dati già presenti su questo telefono</label>' : ''}<button data-a=screa class=w style="margin-top:6px">Crea ristorante</button></div>`
    + `<div class=card><button class="g d" data-a=sout>Esci dall'account</button></div>`;
}

async function busyRun(btn, fn) {
  if (btn) btn.disabled = true;
  try { await fn(); } catch (e) { alert(errText(e)); } finally { if (btn) btn.disabled = false; draw(); }
}

function inviteMsg(code, r) {
  return `Entra nella brigata di ${Cloud.rname || S.loc} su Brigata (${ROLES[r].toLowerCase()}).\n1. Apri ${new URL('./', location.href).href}\n2. Vai in Staff e crea il tuo account\n3. Inserisci il codice: ${code}`;
}

function memDialog(uidm) {
  const x = (Cloud.members || []).find(m => m.user_id == uidm); if (!x) return;
  const D = $('#d');
  D.innerHTML = `<h3 style="margin:0 0 6px">${esc(x.name || 'Senza nome')}</h3><div class=m>Ruolo attuale: ${ROLES[x.role]}</div>
    <div style="display:grid;gap:8px;margin-top:12px">${['manager','cook'].map(r => `<button type=button data-r=${r} class="${x.role == r ? '' : 'g'}">${ROLES[r]}</button>`).join('')}<button type=button class="g d" id=mrm>Togli dalla brigata</button><button type=button class=g id=dc>Chiudi</button></div>`;
  D.showModal();
  D.querySelectorAll('[data-r]').forEach(b => b.onclick = () => busyRun(b, async () => { await Cloud.setRole(x.user_id, b.dataset.r); act('team', `${x.name}: ora ${ROLES[b.dataset.r].toLowerCase()}`); D.close(); }));
  $('#mrm').onclick = () => { if (confirm(`Togliere ${x.name} dalla brigata? Non vedrà più i dati del ristorante.`)) busyRun($('#mrm'), async () => { await Cloud.removeMember(x.user_id); act('team', `${x.name} tolto dalla brigata`); D.close(); }); };
  $('#dc').onclick = () => D.close();
}

function showCode(code, r) {
  const D = $('#d');
  D.innerHTML = `<h3 style="margin:0 0 6px">Codice per ${r == 'cook' ? 'un cuoco' : 'un responsabile'}</h3><div class=code>${code}</div><div class=m>Vale 7 giorni. Chi lo riceve crea l'account in Staff e inserisce il codice.</div><div class=row style="margin-top:12px"><button type=button class=g id=dc>Chiudi</button><button type=button id=dsh>Invia su WhatsApp</button></div>`;
  D.showModal();
  $('#dc').onclick = () => D.close();
  $('#dsh').onclick = () => shareText(inviteMsg(code, r));
}

Object.assign(A, {
  sau: id => { auMode = id; auErr = ''; auCode = ''; draw(); },
  spw: (id, el) => { const p = $('#auf [name=pw]'); p.type = p.type == 'password' ? 'text' : 'password'; el.textContent = p.type == 'password' ? 'Mostra' : 'Nascondi'; },
  sgo2: async (id, el) => {
    const f = $('#auf'), em = f.em.value.trim().toLowerCase(), pw = f.pw.value, nm = f.nm ? f.nm.value.trim() : '';
    auEm = em; auNm = nm; auPw = pw;
    if (!em || !pw) { auErr = 'Scrivi email e password'; return draw(); }
    if (auMode == 'up' && !nm) { auErr = 'Scrivi il tuo nome'; return draw(); }
    if (auMode == 'up' && pw.length < 6) { auErr = 'La password deve avere almeno 6 caratteri'; return draw(); }
    if (pw != pw.trim() && !confirm('La password inizia o finisce con uno spazio (succede con il completamento automatico della tastiera). Continuare così?')) return;
    auBusy = true; auErr = ''; auCode = ''; draw();
    try {
      if (auMode == 'up') { const r = await Cloud.signUp(em, pw, nm); if (r == 'confirm') { auMode = 'in'; alert('Account creato! Ti abbiamo mandato una email: apri il link di conferma da questo telefono ed entri direttamente. Se non arriva, controlla nello spam.'); } }
      else await Cloud.signIn(em, pw);
      auPw = auNm = ''; auMode = 'in';
    } catch (e) { auErr = errText(e); auCode = e.code || ''; }
    auBusy = false; draw();
  },
  srs: (id, el) => busyRun(el, async () => { await Cloud.resend(auEm); alert('Email di conferma inviata a ' + auEm + '. Controlla anche lo spam.'); auErr = ''; }),
  sfp: () => {
    const em = ($('#auf [name=em]').value || auEm).trim().toLowerCase();
    if (!em) { auErr = 'Scrivi prima la tua email, poi tocca "Password dimenticata?"'; return draw(); }
    auEm = em;
    Cloud.recover(em).then(() => alert('Ti abbiamo mandato una email a ' + em + ': apri il link da questo telefono e scegli una nuova password.')).catch(e => alert(errText(e)));
  },
  sout: () => logoutDialog(),
  sgo: id => Cloud.enter(id),
  snew: () => { Cloud.leave(); tab = 'stf'; draw(); },
  sjoin: (id, el) => {
    const c = $('#jc').value.trim().toUpperCase(), n = $('#jn').value.trim();
    if (c.length < 6 || !n) return alert('Scrivi il codice e il tuo nome.');
    busyRun(el, () => Cloud.join(c, n));
  },
  screa: (id, el) => {
    const n = $('#rn').value.trim(), m = $('#rm').value.trim(), seed = $('#rs') && $('#rs').checked ? S : null;
    if (!n || !m) return alert('Scrivi il nome del locale e il tuo nome.');
    busyRun(el, () => Cloud.create(n, m, seed));
  },
  ssy: () => { Cloud.actsAt = Cloud.teamAt = 0; Cloud.loadTeam(true).catch(() => {}); Cloud.sync(); },
  sme: () => ed('Il tuo nome', `<input name=n value="${esc(Cloud.name)}" placeholder="Nome">`, d => { const n = v(d, 'n').trim(); if (!n) return false; Cloud.setName(n).then(draw).catch(e => alert(errText(e))); }),
  smem: id => memDialog(id),
  sinv: (id, el) => busyRun(el, async () => { const c = await Cloud.invite(id); showCode(c, id); }),
  sshr: (id, el) => shareText(inviteMsg(id, el.dataset.r)),
  sdi: (id, el) => { if (confirm('Annullare il codice ' + id + '?')) busyRun(el, () => Cloud.delInvite(id)); },
  saf: id => { actF = id; draw(); }
});

function newPwDialog() {
  const D = $('#d');
  D.innerHTML = `<h3 style="margin:0 0 6px">Nuova password</h3><div class=m>Scegli la nuova password del tuo account.</div><input id=np type=password autocomplete=new-password placeholder="Nuova password (almeno 6 caratteri)"><div class=row style="margin-top:12px"><button type=button class=g id=dc>Annulla</button><button type=button id=ds>Salva</button></div>`;
  D.showModal();
  $('#dc').onclick = () => D.close();
  $('#ds').onclick = () => {
    const p = $('#np').value;
    if (p.length < 6) return alert('Almeno 6 caratteri.');
    busyRun($('#ds'), async () => { await Cloud.setPassword(p); await Cloud.afterLogin(); tst('Password cambiata'); D.close(); });
  };
}

function logoutDialog() {
  if (!Cloud.rid) return Cloud.signOut();
  const D = $('#d'), n = Cloud.countPending();
  D.innerHTML = `<h3 style="margin:0 0 6px">Uscire dall'account?</h3><div class=m>I dati di ${esc(Cloud.rname || S.loc)} sono salvati online: quando rientri li ritrovi tutti.${n ? ` Ci sono ${n} modifiche non ancora inviate: provo a inviarle ora, altrimenti partono al prossimo accesso.` : ''}</div>
    <div style="display:grid;gap:8px;margin-top:14px"><button type=button id=lo1>Esci</button><button type=button class="g d" id=lo2>Esci e cancella i dati da questo telefono</button><button type=button class=g id=dc>Annulla</button></div>
    <div class=hint>Cancella i dati solo se il telefono non è tuo o lo usano altre persone.</div>`;
  D.showModal();
  $('#dc').onclick = () => D.close();
  $('#lo1').onclick = () => { D.close(); Cloud.signOut(false); };
  $('#lo2').onclick = () => {
    if (n && !confirm(`${n} modifiche non ancora inviate andranno perse. Continuare?`)) return;
    D.close(); Cloud.signOut(true);
  };
}
