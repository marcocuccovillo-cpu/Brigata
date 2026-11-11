// Brigata — scanner di codici a barre per il carico merce
// Usa la fotocamera e il lettore integrato del browser (Chrome su Android).
// Legge EAN/UPC dei prodotti e le etichette GS1 dei fornitori (GS1-128, DataMatrix)
// da cui ricava lotto, scadenza e peso netto.
'use strict';

// ---------- Etichette GS1 ----------
function gs1(raw) {
  let s = String(raw).replace(/^\][A-Za-z]\d/, '');
  const o = {};
  if (/^\(\d{2,4}\)/.test(s)) {
    s.replace(/\((\d{2,4})\)([^(]*)/g, (m, ai, val) => { o[ai] = val.trim(); });
  } else {
    if (!s.includes('\x1d') && !/^(00\d{18}|0[12]\d{14})/.test(s)) return null;
    const FIX = {'00':18, '01':14, '02':14, '11':6, '12':6, '13':6, '15':6, '16':6, '17':6, '20':2};
    let i = 0, g = 0;
    while (i < s.length && g++ < 30) {
      if (s[i] == '\x1d') { i++; continue; }
      const a2 = s.substr(i, 2), a3 = s.substr(i, 3), a4 = s.substr(i, 4);
      const vari = (n) => { let j = s.indexOf('\x1d', i + n); if (j < 0) j = s.length; o[s.substr(i, n)] = s.slice(i + n, j); i = j; };
      if (FIX[a2]) { o[a2] = s.substr(i + 2, FIX[a2]); i += 2 + FIX[a2]; }
      else if (/^3[1-6]\d\d$/.test(a4)) { o[a4] = s.substr(i + 4, 6); i += 10; }
      else if (['10','21','22','30','37'].includes(a2)) vari(2);
      else if (['240','241','250','251','400','401'].includes(a3)) vari(3);
      else break;
    }
  }
  if (!o['01'] && !o['02'] && !o['10'] && !o['17'] && !o['15']) return null;
  const r = {gtin: o['01'] || o['02'] || '', lot: o['10'] || '', exp: '', w: null, cnt: o['37'] ? +o['37'] : null};
  const dt = o['17'] || o['15'] || o['16'];
  if (dt && /^\d{6}$/.test(dt)) {
    const y = 2000 + +dt.slice(0, 2), mo = +dt.slice(2, 4);
    let d = +dt.slice(4, 6);
    if (mo >= 1 && mo <= 12) {
      if (!d) d = new Date(y, mo, 0).getDate();   // giorno 00 = fine mese
      r.exp = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }
  for (const k in o) if (/^310\d$/.test(k)) r.w = +(+o[k] / 10 ** +k[3]).toFixed(3);   // peso netto in kg
  return r;
}

// codice usato nel catalogo: solo cifre senza zeri iniziali (EAN-13, GTIN-14 e UPC dello stesso prodotto coincidono)
const bcKey = c => /^\d+$/.test(c) ? c.replace(/^0+/, '') || '0' : String(c).trim();

// ---------- Fotocamera ----------
const Scan = {
  stream: null, det: null, video: null, t: null, paused: false, last: '', lastT: 0, on: null,
  supported: () => 'BarcodeDetector' in window && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
  gen: 0,
  async start(video, on) {
    this.stop();
    const my = this.gen;
    this.on = on;
    if (!this.supported()) return 'nodet';
    try {
      const have = await BarcodeDetector.getSupportedFormats();
      const want = ['ean_13','ean_8','upc_a','upc_e','code_128','code_39','itf','data_matrix','qr_code'].filter(f => have.includes(f));
      this.det = new BarcodeDetector(want.length ? {formats: want} : undefined);
    } catch (e) { return 'nodet'; }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({video: {facingMode: {ideal: 'environment'}, width: {ideal: 1280}, height: {ideal: 720}}, audio: false});
    } catch (e) { return 'denied'; }
    if (my != this.gen) { this.stream.getTracks().forEach(t => t.stop()); this.stream = null; return 'closed'; }   // finestra chiusa nel frattempo
    video.srcObject = this.stream;
    try { await video.play(); } catch (e) {}
    this.video = video; this.paused = false;
    this.loop();
    return 'ok';
  },
  loop() {
    if (!this.stream) return;
    this.t = setTimeout(async () => {
      if (!this.paused && this.video && this.video.readyState >= 2) {
        try {
          const r = await this.det.detect(this.video), c = r.find(x => x.rawValue);
          if (c && this.stream && !this.paused && !(c.rawValue == this.last && Date.now() - this.lastT < 2500)) this.hit(c.rawValue);
        } catch (e) {}
      }
      this.loop();
    }, 180);
  },
  hit(raw) {
    this.last = raw; this.lastT = Date.now(); this.paused = true;
    if (navigator.vibrate) navigator.vibrate(60);
    this.on(raw);
  },
  resume() { this.paused = false; this.lastT = Date.now(); },
  track() { return this.stream && this.stream.getVideoTracks()[0]; },
  hasTorch() { const t = this.track(); try { return !!(t && t.getCapabilities && t.getCapabilities().torch); } catch (e) { return false; } },
  torch(on) { const t = this.track(); if (t) t.applyConstraints({advanced: [{torch: on}]}).catch(() => {}); },
  stop() { this.gen++; clearTimeout(this.t); if (this.stream) this.stream.getTracks().forEach(t => t.stop()); this.stream = null; this.paused = false; }
};

// Nome del prodotto da Open Food Facts (database libero dei prodotti confezionati)
async function offName(code) {
  if (!/^\d{8,14}$/.test(code) || !navigator.onLine) return '';
  const c = code.length == 14 ? code.slice(1) : code.length < 8 ? code.padStart(8, '0') : code.length > 8 && code.length < 13 ? code.padStart(13, '0') : code;
  try {
    const ctl = new AbortController(); setTimeout(() => ctl.abort(), 5000);
    const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${c}.json?fields=product_name_it,product_name,brands,quantity`, {signal: ctl.signal});
    const j = await r.json();
    if (j.status != 1 || !j.product) return '';
    const p = j.product, n = (p.product_name_it || p.product_name || '').trim();
    if (!n) return '';
    const b = (p.brands || '').split(',')[0].trim();
    return n + (b && !n.toLowerCase().includes(b.toLowerCase()) ? ' ' + b : '') + (p.quantity ? ' ' + p.quantity : '');
  } catch (e) { return ''; }
}

// ---------- Finestra dello scanner ----------
function scanUI(title, handler, onClose) {
  let D = $('#sc');
  if (!D) { D = document.createElement('dialog'); D.id = 'sc'; document.body.appendChild(D); }
  D.innerHTML = `<div class=row style="margin-bottom:8px"><h3 style="margin:0">${title}</h3><button type=button class="g sm" id=scx>Fine</button></div>
    <div class=scv id=scv><video playsinline muted></video><div class=scl></div><button type=button class="sm" id=sct style="display:none">Torcia</button></div>
    <div class=m id=scs style="margin:6px 2px">Avvio della fotocamera…</div>
    <div class=row><input id=scm placeholder="Oppure scrivi il codice" inputmode=numeric autocomplete=off style="margin:0"><button type=button class="g sm" id=scok>OK</button></div>
    <div id=scr></div><div id=scd></div>`;
  if (!D.open) D.showModal();
  const ctl = {D, scr: D.querySelector('#scr'), done: D.querySelector('#scd'), status: t => { D.querySelector('#scs').textContent = t; }, resume: () => { ctl.scr.innerHTML = ''; ctl.cam(true); ctl.status('Inquadra il prossimo codice'); Scan.resume(); }, close: () => D.close(),
    cam: on => { if (ctl.camOk) D.querySelector('#scv').style.display = on ? '' : 'none'; }, camOk: false};
  // mentre si compila la scheda il riquadro della fotocamera si nasconde, così il modulo resta in vista
  const go = raw => { raw = String(raw).trim(); if (raw) { Scan.paused = true; ctl.cam(false); handler(raw, ctl); } };
  D.querySelector('#scok').onclick = () => { const i = D.querySelector('#scm'); go(i.value); i.value = ''; };
  D.querySelector('#scm').onkeydown = e => { if (e.key == 'Enter') { e.preventDefault(); D.querySelector('#scok').click(); } };
  D.querySelector('#scx').onclick = () => D.close();
  D.addEventListener('close', () => { Scan.stop(); if (onClose) onClose(); }, {once: true});
  let tOn = false;
  Scan.start(D.querySelector('video'), raw => go(raw)).then(st => {
    if (st == 'closed') return;
    if (st == 'ok') {
      ctl.camOk = true;
      ctl.status('Inquadra il codice a barre o l\'etichetta del fornitore');
      if (Scan.hasTorch()) { const b = D.querySelector('#sct'); b.style.display = ''; b.onclick = () => { tOn = !tOn; Scan.torch(tOn); b.textContent = tOn ? 'Spegni' : 'Torcia'; }; }
    } else {
      D.querySelector('#scv').style.display = 'none';
      ctl.status(st == 'denied' ? 'Fotocamera non disponibile: consenti l\'accesso alla fotocamera nelle impostazioni del browser, oppure scrivi il codice.' : 'Questo browser non legge i codici dalla fotocamera (funziona con Chrome su Android). Puoi scrivere il codice a mano.');
    }
  });
  return ctl;
}

// ---------- Carico merce ----------
let scLastF = null;

function scMerce() {
  if (!S.fr.length) return alert('Per caricare la merce serve almeno un frigorifero, una cella o un congelatore nel Magazzino.');
  const loaded = [];
  const paintDone = ctl => {
    ctl.done.innerHTML = loaded.length ? `<div class=sub style="font-size:15px">Caricati (${loaded.length})</div>` + loaded.map(x => `<div class=li style="font-size:14px"><div class=row><span>${esc(x.n)}</span><span class=m>${x.q} ${esc(x.u)}</span></div><div class=m style="font-size:12px">${esc(x.where)}${x.l ? ' · lotto ' + esc(x.l) : ''}${x.e ? ' · scade ' + dm(x.e) : ''}</div></div>`).join('') : '';
  };
  scanUI('Carico merce', (raw, ctl) => {
    const g = gs1(raw), key = bcKey(g && g.gtin ? g.gtin : raw), cat = S.bc.find(x => x.id == key);
    const fr0 = (cat && S.fr.find(f => f.id == cat.f)) || S.fr.find(f => f.id == scLastF) || S.fr[0];
    const n0 = cat ? cat.n : '', u0 = g && g.w != null ? 'kg' : cat ? cat.u : 'pz';
    const q0 = g && g.w != null ? g.w : g && g.cnt ? g.cnt : cat ? cat.q || 1 : 1;
    const names = [...new Set([...S.ing.map(i => i.n), ...S.pr.map(p => p.n), ...S.bc.map(b => b.n)])].sort();
    ctl.status(cat ? 'Prodotto riconosciuto' : 'Codice nuovo: scrivi il nome, la prossima volta lo riconosco');
    ctl.scr.innerHTML = `<div class=card style="margin-top:10px;border-color:var(--g)">
      <div class=m style="font-size:12px">Codice ${esc(key)}${g && (g.lot || g.exp || g.w != null) ? ' · etichetta GS1' : ''}</div>
      <input name=n list=scnl placeholder="Prodotto" value="${esc(n0)}"><datalist id=scnl>${names.map(t => `<option value="${esc(t)}">`).join('')}</datalist>
      <div id=sco class=m></div>
      <div class=row><input name=q type=number step=any min=0 inputmode=decimal value="${q0}"><select name=u style="width:120px">${MGU.map(u => `<option ${u == u0 ? 'selected' : ''}>${u}</option>`).join('')}</select></div>
      <div class=row style="gap:6px"><select name=f style="flex:1;min-width:0;width:auto">${S.fr.map(f => `<option value=${f.id} ${f.id == fr0.id ? 'selected' : ''}>${esc(f.n)}</option>`).join('')}</select><select name=s style="flex:0 0 122px;width:122px">${shelves(fr0).map((l, i) => `<option value=${i + 1} ${cat && cat.f == fr0.id && cat.s == i + 1 ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <input name=l placeholder="Lotto" value="${esc(g ? g.lot : '')}"><div class=m>Scadenza</div><input name=e type=date value="${g ? g.exp : ''}">
      ${cat ? '' : '<label class=chk><input type=checkbox name=rem checked>Ricorda questo codice</label>'}
      <div class=row style="margin-top:8px"><button type=button class=g id=scsk>Salta</button><button type=button id=scld>Carica</button></div></div>`;
    const C = ctl.scr, f = k => C.querySelector(`[name=${k}]`);
    const ordInfo = () => { const o = S.sp.find(x => !x.ok && x.n.toLowerCase() == f('n').value.trim().toLowerCase()); C.querySelector('#sco').innerHTML = o ? `Nell'ordine: <b>${o.q} ${esc(o.u)}</b>` : ''; };
    f('n').oninput = ordInfo; ordInfo();
    f('f').onchange = () => { const fu = S.fr.find(x => x.id == f('f').value); f('s').innerHTML = shelves(fu).map((l, i) => `<option value=${i + 1}>${l}</option>`).join(''); };
    if (!cat) offName(key).then(nm => { if (nm && !f('n').value) { f('n').value = nm; ordInfo(); ctl.status('Nome trovato online: controllalo prima di caricare'); } });
    else if (!g || !g.exp) f('e').focus();
    C.querySelector('#scsk').onclick = () => ctl.resume();
    C.querySelector('#scld').onclick = () => {
      const n = f('n').value.trim(), q = num(f('q').value), u = f('u').value, fid = f('f').value, s = +f('s').value || 1, l = f('l').value.trim(), e = f('e').value;
      if (!n || !(q > 0)) return alert('Scrivi il prodotto e la quantità.');
      // catalogo codici
      if (cat) Object.assign(cat, {n, u, f: fid, s, ...(g && g.w != null ? {} : {q})});
      else if (f('rem') && f('rem').checked) S.bc.push({id: key, n, u, q: g && g.w != null ? 1 : q, f: fid, s});
      // magazzino
      const m = S.pr.find(y => y.f == fid && (+y.s || 1) == s && y.n.toLowerCase() == n.toLowerCase() && y.u == u && (y.l || '') == l && (y.e || '') == e);
      if (m) m.q = +(m.q + q).toFixed(3); else S.pr.push({id: uid(), n, q: +q.toFixed(3), u, f: fid, s, l, e});
      // ordine merci
      const o = S.sp.find(x => !x.ok && x.n.toLowerCase() == n.toLowerCase());
      let ordTxt = '';
      if (o && o.u == u) { o.q = +(o.q - q).toFixed(3); if (o.q <= 0) { S.sp = S.sp.filter(x => x != o); ordTxt = ' · ordine completo'; } else ordTxt = ` · mancano ${o.q} ${o.u}`; }
      scLastF = fid;
      const fu = S.fr.find(x => x.id == fid);
      loaded.unshift({n, q, u, l, e, where: fu.n + (fu.k == 'cong' ? '' : ' · ' + shelves(fu)[s - 1])});
      act('merce', `${n} ${q} ${u}${l ? ' · lotto ' + l : ''}${e ? ' · scade ' + dm(e) : ''}${ordTxt}`);
      save();
      tst(n + ' caricato' + ordTxt);
      paintDone(ctl);
      ctl.resume();
    };
  }, () => { if (loaded.length) tst(loaded.length + ' prodotti caricati in magazzino'); draw(); });
}

// Lettura singola: riempie il modulo del lotto HACCP
function scLot() {
  const d = $('#d');
  scanUI('Scansiona etichetta', async (raw, ctl) => {
    const g = gs1(raw), key = bcKey(g && g.gtin ? g.gtin : raw), cat = S.bc.find(x => x.id == key);
    const set = (k, val) => { const e = d.querySelector(`[name=${k}]`); if (e && val) e.value = val; };
    set('l', g && g.lot); set('e', g && g.exp);
    ctl.close();
    let n = cat ? cat.n : '';
    if (!n && !d.querySelector('[name=n]').value) n = await offName(key);
    set('n', n);
    tst(g && (g.lot || g.exp) ? 'Lotto e scadenza letti dall\'etichetta' : n ? 'Prodotto riconosciuto' : 'Codice letto: completa a mano');
  });
}

// ---------- Codici salvati ----------
function mgCod() {
  const L = [...S.bc].sort((a, b) => a.n.localeCompare(b.n));
  return `<button class=g data-a=xmb style="margin-bottom:10px">‹ Magazzino</button><div class=card><b>Codici a barre salvati</b><div class=m style="margin-top:4px">Quando scansioni un codice nuovo e scrivi il nome, Brigata lo ricorda per tutta la brigata insieme a unità e posizione abituale.</div></div>`
    + (L.map(b => { const f = S.fr.find(x => x.id == b.f); return `<div class=card data-a=xbce data-id="${esc(b.id)}" style="padding:10px 12px;margin-bottom:6px;cursor:pointer"><div class=row><b>${esc(b.n)}</b><span class=m>${esc(b.u)}</span></div><div class=m style="font-size:12px">${esc(b.id)}${f ? ' · ' + esc(f.n) : ''}</div></div>`; }).join('') || '<div class=empty>Nessun codice salvato. Usa "Scansiona merce" quando arriva un ordine.</div>');
}

function eBc(id) {
  const b = S.bc.find(x => x.id == id); if (!b) return;
  ed('Codice ' + esc(b.id), `<input name=n value="${esc(b.n)}" placeholder="Prodotto"><div class=row><input name=q type=number step=any inputmode=decimal value="${b.q || 1}"><select name=u>${MGU.map(u => `<option ${u == b.u ? 'selected' : ''}>${u}</option>`).join('')}</select></div><div class=m>Quantità proposta a ogni scansione</div>`, d => {
    if (!v(d, 'n').trim()) return false;
    Object.assign(b, {n: v(d, 'n').trim(), q: num(v(d, 'q')) || 1, u: v(d, 'u')});
  }, `<button type=button class="g d" id=bcx>Elimina</button>`);
  $('#bcx').onclick = () => { if (confirm('Dimenticare questo codice?')) { S.bc = S.bc.filter(x => x.id != id); save(); $('#d').close(); } };
}

Object.assign(A, {xscn: () => scMerce(), xcod: () => { mgs = 'codici'; draw(); scrollTo(0, 0); }, xbce: id => eBc(id), xslt: () => scLot()});
