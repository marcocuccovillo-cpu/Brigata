// Brigata — account, ristoranti e sincronizzazione con Supabase (funziona anche offline)
//
// Come funziona: ogni elemento (ricetta, lettura di temperatura, prodotto…) è una riga
// della tabella "items". Il telefono tiene tutto in locale e ricorda l'impronta (hash)
// dell'ultima versione inviata/ricevuta di ogni riga: le righe con impronta diversa sono
// modifiche da inviare. Quando c'è rete: prima invia, poi scarica ciò che è cambiato.
// Se due persone modificano la stessa riga vince l'ultima modifica.
'use strict';

const CFG = window.BRIGATA_CONFIG || {};
const KV = ['loc','logo','cap','memo','memoD','prof','cw','tpl','pub'];
const COOKW = ['log','done','lots','pren','pr','sp','nt','tv','sc','bc'];   // uguale a cook_can_write() nel database

// JSON con chiavi ordinate: la stessa riga dà sempre la stessa stringa
function canon(v) {
  if (Array.isArray(v)) return '[' + v.map(x => x === undefined ? 'null' : canon(x)).join(',') + ']';
  if (v && typeof v == 'object') return '{' + Object.keys(v).sort().filter(k => v[k] !== undefined && typeof v[k] != 'function').map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
  const s = JSON.stringify(v);
  return s === undefined ? 'null' : s;
}
function hash(s) {   // cyrb53
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
const uuid4 = () => crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c == 'x' ? r : r & 3 | 8).toString(16); });

class ApiError extends Error {
  constructor(status, msg, offline) { super(msg); this.status = status; this.offline = !!offline; }
}
const errText = e => e && e.offline ? 'Nessuna connessione' : (e && e.message) || 'Errore sconosciuto';

const Cloud = {
  on: !!(CFG.supabaseUrl && CFG.supabaseKey),
  sess: null, user: null,
  rid: null, role: null, name: '', rname: '',
  list: [], m: null,
  state: 'idle', err: '', last: null, pending: 0,
  busy: false, again: false, timer: null,
  members: null, invites: null, teamAt: 0, actsAt: 0, force: new Set(),

  // ---------- rete ----------
  async api(path, o = {}, retry = true) {
    const h = {apikey: CFG.supabaseKey, 'Content-Type': 'application/json', ...(o.headers || {})};
    const tok = o.anon ? null : await this.token();
    if (tok) h.Authorization = 'Bearer ' + tok;   // senza accesso basta la chiave in "apikey" (le chiavi sb_publishable non vanno nel Bearer)
    let r;
    try {
      r = await fetch(CFG.supabaseUrl.replace(/\/$/, '') + path, {method: o.method || 'GET', headers: h, body: o.body === undefined ? undefined : JSON.stringify(o.body)});
    } catch (e) { throw new ApiError(0, 'Nessuna connessione', true); }
    if (r.status == 401 && retry && tok && this.sess) {
      if (await this.refresh(true)) return this.api(path, o, false);
    }
    const t = await r.text();
    let j = null;
    try { j = t ? JSON.parse(t) : null; } catch (e) {}
    if (!r.ok) {
      const m = j && (j.msg || j.message || j.error_description || j.error) || ('Errore ' + r.status);
      const err = new ApiError(r.status, this.tr(m));
      err.code = j && (j.error_code || j.code) || '';
      if (/email not confirmed/i.test(m)) err.code = 'email_not_confirmed';
      throw err;
    }
    return j;
  },
  rpc(fn, args) { return this.api('/rest/v1/rpc/' + fn, {method: 'POST', body: args || {}}); },
  tr(m) {   // messaggi di Supabase in italiano
    const T = {
      'Invalid login credentials': 'Email o password sbagliate',
      'User already registered': 'Esiste già un account con questa email: accedi',
      'Email not confirmed': 'Conferma prima l\'email: apri il link che ti abbiamo mandato',
      'Password should be at least 6 characters': 'La password deve avere almeno 6 caratteri',
      'Unable to validate email address: invalid format': 'Email non valida',
      'Signup requires a valid password': 'Scrivi una password',
      'Email rate limit exceeded': 'Troppi tentativi: riprova tra qualche minuto'
    };
    for (const k in T) if (String(m).toLowerCase().includes(k.toLowerCase())) return T[k];
    if (/row-level security|permission denied/i.test(m)) return 'Non hai i permessi per questa modifica';
    return String(m).replace(/^ERROR:\s*/, '');
  },

  // ---------- accesso ----------
  setSess(r) {
    if (!r || !r.access_token) return false;
    const u = r.user || (this.sess && this.sess.user) || {};
    this.sess = {access_token: r.access_token, refresh_token: r.refresh_token, expires_at: r.expires_at || Math.floor(Date.now() / 1000) + (r.expires_in || 3600), user: {id: u.id, email: u.email, name: (u.user_metadata || {}).name || ''}};
    this.user = this.sess.user;
    localStorage.setItem('br_auth', JSON.stringify(this.sess));
    return true;
  },
  async token() {
    if (!this.sess) return null;
    if (this.sess.expires_at - 60 < Date.now() / 1000) await this.refresh();
    return this.sess && this.sess.access_token;
  },
  async refresh(force) {
    if (!this.sess) return false;
    if (this._ref) return this._ref;
    this._ref = (async () => {
      try {
        const r = await fetch(CFG.supabaseUrl.replace(/\/$/, '') + '/auth/v1/token?grant_type=refresh_token', {method: 'POST', headers: {apikey: CFG.supabaseKey, 'Content-Type': 'application/json'}, body: JSON.stringify({refresh_token: this.sess.refresh_token})});
        if (r.ok) return this.setSess(await r.json());
        if (r.status >= 400 && r.status < 500) { this.lost(); return false; }   // sessione non più valida
        return false;
      } catch (e) { return false; }   // offline: si continua con i dati locali
      finally { this._ref = null; }
    })();
    return this._ref;
  },
  lost() {   // la sessione è scaduta: i dati locali restano, serve accedere di nuovo
    this.sess = null; this.user = null;
    localStorage.removeItem('br_auth');
    this.state = 'err'; this.err = 'Accedi di nuovo per sincronizzare';
  },
  appUrl: () => new URL('./', location.href).href,
  async signUp(email, pw, name) {
    const r = await this.api('/auth/v1/signup?redirect_to=' + encodeURIComponent(this.appUrl()), {method: 'POST', body: {email, password: pw, data: {name}}, anon: true});
    // con la conferma email attiva Supabase non dà errore se l'email esiste già: restituisce un utente senza identità
    if (!r.access_token && r.identities && !r.identities.length) throw new ApiError(422, 'Esiste già un account con questa email: accedi o usa "Password dimenticata?"');
    if (this.setSess(r)) { await this.afterLogin(); return 'ok'; }
    return 'confirm';
  },
  async signIn(email, pw) {
    const r = await this.api('/auth/v1/token?grant_type=password', {method: 'POST', body: {email, password: pw}, anon: true});
    this.setSess(r);
    await this.afterLogin();
  },
  async resend(email) { await this.api('/auth/v1/resend?redirect_to=' + encodeURIComponent(this.appUrl()), {method: 'POST', body: {type: 'signup', email}, anon: true}); },
  async recover(email) { await this.api('/auth/v1/recover?redirect_to=' + encodeURIComponent(this.appUrl()), {method: 'POST', body: {email}, anon: true}); },
  async setPassword(pw) { await this.api('/auth/v1/user', {method: 'PUT', body: {password: pw}}); },
  // link della mail (conferma account o nuova password): i dati di accesso arrivano dopo il # dell'indirizzo
  async fromLink() {
    const h = new URLSearchParams(location.hash.slice(1));
    if (!h.get('access_token') && !h.get('error_description')) return;
    history.replaceState(null, '', location.pathname + location.search);
    tab = 'stf';
    if (h.get('error_description')) { alert(/expired|invalid/i.test(h.get('error_description')) ? 'Il link della mail è scaduto o è già stato usato. Accedi oppure chiedi una nuova mail.' : h.get('error_description')); return draw(); }
    const tk = h.get('access_token');
    try {
      const r = await fetch(CFG.supabaseUrl.replace(/\/$/, '') + '/auth/v1/user', {headers: {apikey: CFG.supabaseKey, Authorization: 'Bearer ' + tk}});
      if (!r.ok) throw 0;
      this.setSess({access_token: tk, refresh_token: h.get('refresh_token'), expires_in: +h.get('expires_in') || 3600, expires_at: +h.get('expires_at') || 0, user: await r.json()});
      if (h.get('type') == 'recovery') { draw(); newPwDialog(); return; }
      tst('Account confermato: sei dentro');
      await this.afterLogin();
    } catch (e) { alert('Non riesco a completare l\'accesso dal link: accedi con email e password.'); }
    draw();
  },
  async afterLogin() {
    await this.loadList();
    const saved = localStorage.getItem('br_rid');
    const pick = this.list.find(x => x.restaurant_id == saved) || (this.list.length == 1 ? this.list[0] : null);
    if (pick) this.enter(pick.restaurant_id);
  },
  // Uscita: i dati del ristorante restano sul telefono (si ritrovano subito al prossimo accesso)
  // a meno che si scelga di cancellarli, per esempio su un telefono condiviso.
  async signOut(wipe) {
    const rid = this.rid;
    if (rid && !wipe && this.countPending()) { try { await this.sync(); } catch (e) {} }   // prova a inviare prima di uscire
    try { await this.api('/auth/v1/logout', {method: 'POST'}); } catch (e) {}
    if (rid) {
      this.saveMeta();
      if (wipe) { localStorage.removeItem('br:' + rid); localStorage.removeItem('brm:' + rid); localStorage.removeItem('br_last'); }
      else localStorage.setItem('br_last', this.rname || S.loc || 'il ristorante');
    }
    this.m = null; this.rid = null;   // prima di leave(): niente salvataggi del riepilogo dopo la pulizia
    localStorage.removeItem('br_auth');
    if (wipe) localStorage.removeItem('br_rid');
    this.sess = null; this.user = null; this.list = [];
    this.leave(true);
    tab = 'stf'; draw();
  },

  // ---------- ristoranti ----------
  async loadList() { this.list = (await this.rpc('my_restaurants')) || []; return this.list; },
  async create(name, myName, seed) {
    const rid = await this.rpc('create_restaurant', {p_name: name, p_my_name: myName});
    await this.loadList();
    this.enter(rid, seed);
    if (!S.loc) { S.loc = name; save(); }
    act('team', 'Ristorante creato');
  },
  async join(code, myName) {
    const rid = await this.rpc('join_restaurant', {p_code: code, p_my_name: myName});
    await this.loadList();
    this.enter(rid);
    act('team', 'Entrato nella brigata');
  },
  enter(rid, seed) {
    if (this.rid) this.saveMeta();
    this.rid = rid;
    localStorage.setItem('br_rid', rid);
    this.m = this.readMeta(rid);
    load('br:' + rid);
    localStorage.removeItem('br_last');
    const me = this.list.find(x => x.restaurant_id == rid);
    if (me) { this.m.role = me.role; this.m.name = me.my_name; this.m.rname = me.name; }
    this.role = this.m.role || 'cook'; this.name = this.m.name || ''; this.rname = this.m.rname || '';
    if (seed) {   // porta nel ristorante i dati che erano solo su questo telefono
      const x = JSON.parse(JSON.stringify(seed)); delete x.me;
      S = norm(x);
      if (!S.loc && this.rname) S.loc = this.rname;
      save();
    }
    this.members = this.invites = null; this.teamAt = this.actsAt = 0;
    this.saveMeta();
    draw();
    this.sync();
  },
  leave(keepRid) {   // torna ai dati "solo su questo telefono"
    if (this.rid) this.saveMeta();
    this.rid = null; this.m = null; this.role = null; this.name = this.rname = '';
    if (!keepRid) localStorage.removeItem('br_rid');
    load('cp');
    this.state = 'idle';
    draw();
  },
  // riepilogo della sincronizzazione: vale solo se ci sono anche i dati, altrimenti si riscarica tutto da capo
  readMeta(rid) {
    let m = null;
    try { if (localStorage.getItem('br:' + rid) != null) m = JSON.parse(localStorage.getItem('brm:' + rid)); } catch (e) {}
    if (!m || typeof m != 'object' || !m.synced) m = {synced: {}, ver: {}, cursor: null, cost: {}, act: [], acts: [], pubH: ''};
    return m;
  },
  saveMeta() { if (this.rid && this.m) try { localStorage.setItem('brm:' + this.rid, JSON.stringify(this.m)); } catch (e) {} },

  // ---------- righe ----------
  writable(coll) { return ['owner','manager'].includes(this.role) || COOKW.includes(coll); },
  rows() {
    const m = new Map(), C = ['owner','manager'].includes(this.role);
    const add = (coll, id, data) => m.set(coll + '|' + id, {coll, id: String(id), data, h: hash(canon(data))});
    for (const coll of ARR) for (const el of S[coll]) {
      if (!el || el.id == null) continue;
      const d = {...el}; delete d.id;
      if (coll == 'ing') { if (C) add('cost', 'i:' + el.id, {p: +el.p || 0}); delete d.p; }
      if (coll == 'rec') { if (C) add('cost', 'r:' + el.id, {fc: el.fc, pv: el.pv}); delete d.fc; delete d.pv; }
      add(coll, el.id, d);
    }
    for (const coll of ['sh','done']) for (const k in S[coll]) add(coll, k, {v: S[coll][k]});
    for (const k of KV) if (S[k] !== undefined && S[k] !== null && S[k] !== '') add('kv', k, {v: S[k]});
    return m;
  },
  dirty(cur) {
    const M = this.m, out = [];
    for (const [k, r] of cur) if (this.writable(r.coll) && M.synced[k] !== r.h) out.push(r);
    for (const k in M.synced) if (!cur.has(k)) {
      const i = k.indexOf('|'), coll = k.slice(0, i);
      if (this.writable(coll) && !(coll == 'cost' && !['owner','manager'].includes(this.role))) out.push({coll, id: k.slice(i + 1), data: {}, deleted: true});
    }
    return out;
  },
  countPending() { return this.m ? this.dirty(this.rows()).length + this.m.act.length : 0; },
  apply(row) {
    const {coll, id, data, deleted} = row, M = this.m;
    if (coll == 'kv') { if (deleted) delete S[id]; else S[id] = data.v; return; }
    if (coll == 'sh' || coll == 'done') { if (deleted) delete S[coll][id]; else S[coll][id] = data.v; return; }
    if (coll == 'cost') {
      if (deleted) delete M.cost[id]; else M.cost[id] = data;
      const c = M.cost[id] || {}, x = id.slice(2);
      if (id[0] == 'i') { const i = S.ing.find(e => e.id == x); if (i) i.p = +c.p || 0; }
      if (id[0] == 'r') { const r = S.rec.find(e => e.id == x); if (r) { r.fc = c.fc ?? 30; r.pv = c.pv ?? 0; } }
      return;
    }
    if (!ARR.includes(coll)) return;   // dato di una versione più nuova dell'app
    const arr = S[coll], i = arr.findIndex(e => e.id == id);
    if (deleted) { if (i >= 0) arr.splice(i, 1); return; }
    const el = {...data, id}, old = i >= 0 ? arr[i] : {};
    if (coll == 'ing') { const c = M.cost['i:' + id]; el.p = c ? +c.p || 0 : old.p || 0; }
    if (coll == 'rec') { const c = M.cost['r:' + id]; el.fc = c ? c.fc ?? 30 : old.fc ?? 30; el.pv = c ? c.pv ?? 0 : old.pv || 0; }
    if (i >= 0) arr[i] = el; else arr.push(el);
  },

  // ---------- sincronizzazione ----------
  schedule(ms) {
    if (!this.rid) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.sync(), ms ?? 1500);
    this.pending = this.countPending();
    badge();
  },
  async sync() {
    if (!this.on || !this.rid || !this.sess) { badge(); return; }
    if (this.busy) { this.again = true; return; }
    this.busy = true; this.state = 'run'; badge();
    let changed = false;
    try {
      await this.loadList();
      const me = this.list.find(x => x.restaurant_id == this.rid);
      if (!me) { this.kicked(); return; }
      if (me.role != this.role || me.my_name != this.name || me.name != this.rname) {
        if (me.role != this.role) {   // nuovo ruolo: riscarica tutto da capo
          this.m.cursor = null; this.m.ver = {};
          if (me.role == 'cook') { this.m.cost = {}; S.ing.forEach(i => i.p = 0); S.rec.forEach(r => { r.fc = 30; r.pv = 0; }); }
        }
        this.role = this.m.role = me.role; this.name = this.m.name = me.my_name; this.rname = this.m.rname = me.name;
        changed = true;
      }
      if (!this.m.cursor) {   // primo scarico su questo telefono: prima i dati del ristorante, poi le aggiunte locali
        changed = await this.pull(true) || changed;
        await this.push();
      } else if (await this.push() == 'reset') {
        changed = await this.pull(true) || changed;
      } else {
        changed = await this.pull() || changed;
      }
      this.revertLocked();
      if (this.force.size) changed = await this.repair() || changed;
      await this.pushAct();
      await this.publish();
      if (tab == 'stf') changed = await this.loadActs() || changed;
      this.state = 'ok'; this.err = ''; this.last = new Date().toISOString();
    } catch (e) {
      this.state = e.offline ? 'offline' : 'err';
      this.err = errText(e);
      if (!e.offline) console.warn('Sincronizzazione:', e);
    } finally {
      this.busy = false;
      if (this.m) { this.pending = this.countPending(); this.saveMeta(); }
      try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) {}
      if (changed) refresh(); else badge();
      if (this.again) { this.again = false; this.schedule(300); }
    }
  },
  async push() {
    const M = this.m, up = this.dirty(this.rows());
    if (!up.length) return;
    // protezione: un telefono che sta per cancellare online più di metà dei dati ha qualcosa che non va
    const nDel = up.filter(r => r.deleted).length, nTot = Object.keys(M.synced).length;
    if (nDel > 20 && nDel > nTot / 2 && !this.allowMass) {
      console.warn('Brigata: troppe cancellazioni insieme, riscarico i dati invece di cancellarli online');
      M.cursor = null; M.ver = {}; M.synced = {};
      return 'reset';
    }
    this.allowMass = false;
    const by = {};
    up.forEach(r => { const g = r.coll + (r.deleted ? '|x' : ''); (by[g] = by[g] || []).push(r); });
    for (const g in by) {
      const L = by[g], coll = L[0].coll;
      for (let i = 0; i < L.length; i += 200) {
        const part = L.slice(i, i + 200);
        try {
          await this.api('/rest/v1/items?on_conflict=restaurant_id,coll,id', {
            method: 'POST',
            headers: {Prefer: (coll == 'log' ? 'resolution=ignore-duplicates' : 'resolution=merge-duplicates') + ',return=minimal'},
            // le cancellazioni non toccano il contenuto: online resta recuperabile
            body: part.map(r => r.deleted ? {restaurant_id: this.rid, coll: r.coll, id: r.id, deleted: true} : {restaurant_id: this.rid, coll: r.coll, id: r.id, data: r.data, deleted: false})
          });
          part.forEach(r => { const k = r.coll + '|' + r.id; if (r.deleted) delete M.synced[k]; else M.synced[k] = r.h; });
        } catch (e) {
          if (e.status == 403) { this.force.add(coll); this.denied = true; break; }   // non permesso dal ruolo: annulla le modifiche locali
          throw e;
        }
      }
    }
  },
  async pull(all) {   // all = applica tutto ciò che arriva, anche sopra le modifiche locali
    const M = this.m, first = !M.cursor, ca = {}, touched = new Set();
    let since = M.cursor ? new Date(new Date(M.cursor).getTime() - 60000).toISOString() : null, op = 'gte';
    for (;;) {
      const rows = await this.api(`/rest/v1/items?select=coll,id,data,deleted,updated_at,created_at&restaurant_id=eq.${this.rid}` + (since ? `&updated_at=${op}.${encodeURIComponent(since)}` : '') + '&order=updated_at.asc&limit=1000');
      if (!rows || !rows.length) break;
      const cur = this.rows();
      for (const row of rows) {
        const k = row.coll + '|' + row.id;
        if (M.ver[k] === row.updated_at) continue;
        const w = this.writable(row.coll);
        const dirty = w && (cur.has(k) ? cur.get(k).h !== M.synced[k] : M.synced[k] != null);
        if (dirty && !all) continue;   // c'è una modifica locale più recente ancora da inviare
        this.apply(row);
        M.ver[k] = row.updated_at; touched.add(k);
        if (first) ca[k] = row.created_at;
      }
      const lastU = rows[rows.length - 1].updated_at;
      if (!M.cursor || lastU > M.cursor) M.cursor = lastU;
      if (rows.length < 1000) break;
      since = lastU; op = 'gt';
    }
    if (!touched.size) return false;
    norm(S);
    if (first) ARR.forEach(c => S[c].sort((a, b) => (ca[c + '|' + a.id] || '~').localeCompare(ca[c + '|' + b.id] || '~')));
    const cur = this.rows();
    touched.forEach(k => { if (cur.has(k)) M.synced[k] = cur.get(k).h; else delete M.synced[k]; });
    return true;
  },
  revertLocked() {   // modifiche locali a dati che il ruolo non può cambiare: si riprendono quelli del ristorante
    const M = this.m, cur = this.rows();
    for (const [k, r] of cur) if (!this.writable(r.coll) && M.synced[k] !== r.h) this.force.add(r.coll);
    for (const k in M.synced) { const c = k.slice(0, k.indexOf('|')); if (!cur.has(k) && !this.writable(c) && !(c == 'cost' && !['owner','manager'].includes(this.role))) this.force.add(c); }
  },
  async repair() {   // riscarica i tipi di dato che il ruolo non può modificare
    const M = this.m, denied = this.denied;
    for (const coll of this.force) {
      const rows = await this.api(`/rest/v1/items?select=coll,id,data,deleted,updated_at&restaurant_id=eq.${this.rid}&coll=eq.${coll}&limit=10000`) || [];
      const ids = new Set(rows.filter(r => !r.deleted).map(r => r.id));
      if (ARR.includes(coll)) S[coll] = S[coll].filter(e => ids.has(String(e.id)));
      else if (coll == 'sh' || coll == 'done') Object.keys(S[coll]).forEach(k => { if (!ids.has(k)) delete S[coll][k]; });
      else if (coll == 'kv') KV.forEach(k => { if (!ids.has(k)) delete S[k]; });
      rows.forEach(r => { this.apply(r); M.ver[r.coll + '|' + r.id] = r.updated_at; });
      norm(S);
      const cur = this.rows();
      Object.keys(M.synced).forEach(k => { if (k.startsWith(coll + '|')) delete M.synced[k]; });
      cur.forEach((r, k) => { if (r.coll == coll) M.synced[k] = r.h; });
    }
    this.force.clear(); this.denied = false;
    if (denied) tst('Alcune modifiche non sono permesse al tuo ruolo e sono state annullate');
    return true;
  },
  kicked() {
    const rid = this.rid;
    alert('Non fai più parte di questo ristorante. I suoi dati vengono tolti dal telefono.');
    localStorage.removeItem('br:' + rid); localStorage.removeItem('brm:' + rid);
    this.m = null; this.rid = null;
    this.leave();
  },

  // ---------- registro attività ----------
  act(kind, text) {
    if (!this.m) return;
    const a = {id: uuid4(), restaurant_id: this.rid, user_name: this.name || (this.user && this.user.name) || '', kind, text: String(text).slice(0, 300), at: new Date().toISOString()};
    this.m.act.push(a);
    this.m.acts.unshift({...a, local: 1});
    this.m.acts = this.m.acts.slice(0, 300);
    this.saveMeta();
    this.schedule();
  },
  async pushAct() {
    const L = this.m.act.slice(0, 200);
    if (!L.length) return;
    await this.api('/rest/v1/activity?on_conflict=id', {method: 'POST', headers: {Prefer: 'resolution=ignore-duplicates,return=minimal'}, body: L});
    const sent = new Set(L.map(a => a.id));
    this.m.act = this.m.act.filter(a => !sent.has(a.id));
    this.m.acts.forEach(a => { if (sent.has(a.id)) delete a.local; });
  },
  async loadActs(force) {
    if (!force && Date.now() - this.actsAt < 30000) return false;
    this.actsAt = Date.now();
    const r = await this.api(`/rest/v1/activity?select=id,user_name,kind,text,at&restaurant_id=eq.${this.rid}&order=at.desc&limit=300`) || [];
    const ids = new Set(r.map(a => a.id));
    this.m.acts = [...this.m.act.filter(a => !ids.has(a.id)).map(a => ({...a, local: 1})), ...r].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 300);
    return true;
  },

  // ---------- squadra ----------
  async loadTeam(force) {
    if (!this.rid || (!force && Date.now() - this.teamAt < 20000)) return false;
    this.teamAt = Date.now();
    this.members = await this.api(`/rest/v1/members?select=user_id,role,name,joined_at&restaurant_id=eq.${this.rid}&order=joined_at.asc`) || [];
    this.invites = can('invite') ? await this.api(`/rest/v1/invites?select=code,role,expires_at,uses,max_uses&restaurant_id=eq.${this.rid}&order=created_at.desc`) || [] : [];
    return true;
  },
  async invite(r) { const c = await this.rpc('create_invite', {p_rid: this.rid, p_role: r}); act('team', `Codice invito creato (${ROLES[r].toLowerCase()})`); await this.loadTeam(true); return c; },
  async delInvite(code) { await this.api(`/rest/v1/invites?code=eq.${encodeURIComponent(code)}`, {method: 'DELETE'}); await this.loadTeam(true); },
  async setRole(u, r) { await this.api(`/rest/v1/members?restaurant_id=eq.${this.rid}&user_id=eq.${u}`, {method: 'PATCH', body: {role: r}}); await this.loadTeam(true); },
  async removeMember(u) { await this.api(`/rest/v1/members?restaurant_id=eq.${this.rid}&user_id=eq.${u}`, {method: 'DELETE'}); await this.loadTeam(true); },
  async setName(n) { await this.rpc('set_my_name', {p_rid: this.rid, p_name: n}); this.name = this.m.name = n; this.saveMeta(); await this.loadTeam(true); },

  // ---------- menù pubblico ----------
  async publish() {
    if (!['owner','manager'].includes(this.role) || !S.pub || !S.pub.slug) return;
    const M = this.m;
    if (S.pub.on) {
      const d = menuData(), h = hash(canon(d)) + S.pub.slug;
      if (M.pubH === h) return;
      await this.api('/rest/v1/public_menus?on_conflict=restaurant_id', {method: 'POST', headers: {Prefer: 'resolution=merge-duplicates,return=minimal'}, body: {restaurant_id: this.rid, slug: S.pub.slug, data: d, published: true}});
      M.pubH = h;
    } else if (M.pubH && M.pubH != 'off') {
      await this.api(`/rest/v1/public_menus?restaurant_id=eq.${this.rid}`, {method: 'PATCH', body: {published: false}});
      M.pubH = 'off';
    }
  },
  pubState() {
    if (!this.m) return '';
    return this.m.pubH && this.m.pubH != 'off' && this.m.pubH === hash(canon(menuData())) + S.pub.slug ? 'online e aggiornato' : 'in attesa di sincronizzazione';
  },

  // ---------- avvio ----------
  boot() {
    if (!this.on) { load('cp'); return; }
    try { this.sess = JSON.parse(localStorage.getItem('br_auth')); } catch (e) {}
    if (this.sess && this.sess.user) this.user = this.sess.user; else this.sess = null;
    const rid = localStorage.getItem('br_rid');
    if (this.sess && rid) {
      this.m = this.readMeta(rid);
      this.rid = rid; load('br:' + rid);
      this.role = this.m.role || 'cook'; this.name = this.m.name || ''; this.rname = this.m.rname || '';
    } else load('cp');
    addEventListener('online', () => this.sync());
    document.addEventListener('visibilitychange', () => { if (document.visibilityState == 'visible') this.sync(); });
    setInterval(() => { if (document.visibilityState == 'visible') this.sync(); }, 30000);
    if (location.hash.includes('access_token') || location.hash.includes('error_description')) setTimeout(() => this.fromLink(), 0);
    addEventListener('hashchange', () => this.fromLink());
    if (this.rid) setTimeout(() => this.sync(), 300);
    else if (this.sess) this.loadList().then(() => { if (tab == 'stf') draw(); }).catch(() => {});
  }
};

saveHook = () => Cloud.schedule();
