// Brigata — Magazzino: frigoriferi, celle, congelatori, prodotti e ordine merci
'use strict';

const MGK = {frigo:'Frigorifero', cella:'Cella', cong:'Congelatore'};
const MGU = ['kg','g','l','ml','pz','ct','pacchetti'];
let mgs = null;   // null = elenco unità, 'spesa' = ordine merci, altrimenti id dell'unità aperta

const shelves = f => f.k == 'cong' ? ['Pozzetto'] : Array.from({length:f.sh}, (_, i) => (f.k == 'cella' ? 'Scaffale ' : 'Ripiano ') + (i + 1));

function mgDraw(f) {
  const B = 'fill="#fffdf7" stroke="#14120e" stroke-width="3"', G = 'fill="#c9a24a"';
  if (f.k == 'cong') return `<svg viewBox="0 0 120 72" width="100%"><rect x="3" y="14" width="114" height="55" rx="7" ${B}/><rect x="3" y="3" width="114" height="18" rx="6" fill="#14120e"/><rect x="48" y="8" width="24" height="5" rx="2.5" ${G}/><path d="M16 38h88M16 50h88" stroke="#e6dcc3" stroke-width="2"/></svg>`;
  const w = f.k == 'cella' ? 100 : 76;
  const sl = Array.from({length:Math.max(0, f.sh - 1)}, (_, i) => `<path d="M10 ${12 + 96 * (i + 1) / f.sh}H${w - 10}" stroke="#d5c79d" stroke-width="2"/>`).join('');
  return `<svg viewBox="0 0 ${w} 120" width="100%"><rect x="3" y="3" width="${w - 6}" height="114" rx="8" ${B}/>${sl}${f.a == 2 && f.k == 'frigo' ? `<path d="M${w / 2} 3V117" stroke="#14120e" stroke-width="3"/><rect x="${w / 2 - 8}" y="50" width="4" height="22" rx="2" ${G}/><rect x="${w / 2 + 4}" y="50" width="4" height="22" rx="2" ${G}/>` : `<rect x="${w - 14}" y="50" width="4" height="22" rx="2" ${G}/>`}</svg>`;
}

function mgFr(id) {
  const n = !id, f = S.fr.find(x => x.id == id) || {id:uid(), n:'', k:'frigo', a:1, sh:4};
  ed(n ? 'Nuova unità' : 'Modifica unità',
    `<input name=n placeholder="Nome (es. Frigo verdure)" value="${esc(f.n)}">
     <select name=k>${Object.entries(MGK).map(([k, l]) => `<option value=${k} ${k == f.k ? 'selected' : ''}>${l}</option>`).join('')}</select>
     <select name=a><option value=1 ${f.a == 1 ? 'selected' : ''}>Anta singola</option><option value=2 ${f.a == 2 ? 'selected' : ''}>Anta doppia</option></select>
     <input name=sh type=number min=1 max=12 inputmode=numeric placeholder="Ripiani / scaffali" value="${f.sh}">
     <div class=m>Frigo: ripiani e ante. Cella: scaffali. Congelatore: pozzetto orizzontale, senza ripiani.</div>`,
    d => {
      if (!v(d, 'n').trim()) return false;
      const k = v(d, 'k');
      Object.assign(f, {n:v(d, 'n').trim(), k, a:+v(d, 'a'), sh:k == 'cong' ? 1 : Math.min(12, Math.max(1, +v(d, 'sh') || 1))});
      S.pr.filter(p => p.f == f.id && (+p.s || 1) > f.sh).forEach(p => p.s = f.sh);   // niente prodotti su ripiani spariti
      if (n) S.fr.push(f);
    });
}

function mgIt(id, fid, sh) {
  const n = !id, p = S.pr.find(x => x.id == id) || {id:uid(), n:'', q:1, u:'kg', f:fid, s:sh, l:'', e:''}, std = MGU.includes(p.u);
  const f = S.fr.find(x => x.id == p.f);
  ed(n ? 'Nuovo prodotto' : 'Prodotto',
    `<input name=n list=dl placeholder="Prodotto" value="${esc(p.n)}"><datalist id=dl>${S.ing.map(i => `<option value="${esc(i.n)}">`).join('')}</datalist>
     <div class=row><input name=q type=number step=any inputmode=decimal value="${p.q}"><select name=u>${MGU.map(u => `<option ${u == p.u ? 'selected' : ''}>${u}</option>`).join('')}</select></div>
     <input name=uc placeholder="Altra unità (se non in lista)" value="${std ? '' : esc(p.u)}">
     ${f && f.k != 'cong' ? `<select name=s>${shelves(f).map((l, i) => `<option value=${i + 1} ${i + 1 == (+p.s || 1) ? 'selected' : ''}>${l}</option>`).join('')}</select>` : ''}
     <input name=l placeholder="Lotto (facoltativo)" value="${esc(p.l || '')}"><div class=m>Scadenza (facoltativa)</div><input name=e type=date value="${p.e || ''}">`,
    d => {
      if (!v(d, 'n').trim()) return false;
      Object.assign(p, {n:v(d, 'n').trim(), q:num(v(d, 'q')), u:v(d, 'uc').trim() || v(d, 'u'), l:v(d, 'l').trim(), e:v(d, 'e')});
      if (v(d, 's')) p.s = +v(d, 's');
      if (n) S.pr.push(p);
    },
    n ? '' : `<button type=button class="g d" id=xpd>Elimina</button><button type=button class=g id=xps>Scarto</button>`);
  if (!n) {
    $('#xpd').onclick = () => { if (confirm('Eliminare ' + p.n + '?')) { S.pr = S.pr.filter(x => x.id != p.id); save(); $('#d').close(); } };
    $('#xps').onclick = () => {
      const u = ['kg','g','l','ml','pz'].includes(p.u) ? p.u : 'pz';
      eSc(null, {n:p.n, q:'', u, mot:p.e && days(p.e) < 0 ? 'Scaduto / deteriorato' : MOT[0]}, x => {
        if (x.u == p.u) { p.q = Math.max(0, +(p.q - x.q).toFixed(2)); tst(`${p.n}: restano ${p.q} ${p.u}`); }
      });
    };
  }
}

function mgSpE() {
  ed('Aggiungi all\'ordine',
    `<input name=n list=dl2 placeholder="Prodotto"><datalist id=dl2>${[...new Set([...S.ing.map(i => i.n), ...S.pr.map(p => p.n)])].map(x => `<option value="${esc(x)}">`).join('')}</datalist>
     <div class=row><input name=q type=number step=any inputmode=decimal value=1><select name=u>${MGU.map(u => `<option>${u}</option>`).join('')}</select></div>
     <input name=uc placeholder="Altra unità (facoltativa)">`,
    d => {
      if (!v(d, 'n').trim()) return false;
      S.sp.push({id:uid(), n:v(d, 'n').trim(), q:num(v(d, 'q')) || 1, u:v(d, 'uc').trim() || v(d, 'u'), ok:0});
    });
}

const mgTxt = () => 'Ordine merci' + (S.loc ? ' — ' + S.loc : '') + '\n' + S.sp.filter(x => !x.ok).map(x => '• ' + x.n + ' — ' + x.q + ' ' + x.u).join('\n');

function mgImg() {
  const L = S.sp.filter(x => !x.ok), c = document.createElement('canvas'), W = 720, H = 150 + L.length * 56 + 40;
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#faf6ec'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#14120e'; g.fillRect(0, 0, W, 90);
  g.fillStyle = '#c9a24a'; g.font = 'bold 34px Georgia'; g.fillText('Ordine merci', 30, 58);
  g.font = '28px system-ui';
  L.forEach((x, i) => { g.strokeStyle = '#14120e'; g.lineWidth = 2; g.strokeRect(30, 128 + i * 56, 26, 26); g.fillStyle = '#14120e'; g.fillText(x.n + '  —  ' + x.q + ' ' + x.u, 74, 152 + i * 56); });
  g.fillStyle = '#6f6753'; g.font = '20px system-ui'; g.fillText((S.loc || 'Brigata') + ' · ' + new Date().toLocaleDateString('it'), 30, H - 16);
  shareCanvas(c, 'ordine-merci.png');
}

function mgUn(f) {
  const E = can('edit'), L = S.pr.filter(x => x.f == f.id), nm = f.k == 'cella' ? 'Scaffale' : f.k == 'cong' ? 'Pozzetto' : 'Ripiano';
  const row = p => {
    const k = p.e ? days(p.e) : 0;
    return `<div class=li><div class=row><div data-a=xei data-id=${p.id} style="flex:1;cursor:pointer"><b>${esc(p.n)}</b><div class=m><span class="${p.q <= 0 ? 'bad' : ''}">${p.q} ${esc(p.u)}</span>${p.l ? ` · lotto ${esc(p.l)}` : ''}${p.e ? ` · <span class="${k < 0 ? 'bad' : k <= 2 ? 'warn' : ''}">scade ${dm(p.e)}</span>` : ''}</div></div><div class=row style="gap:4px"><button class="g sm" data-a=xqm data-id=${p.id}>−</button><button class="g sm" data-a=xqp data-id=${p.id}>+</button><button class="g sm" data-a=xcs data-id=${p.id}>Ordina</button></div></div></div>`;
  };
  return `<button class=g data-a=xmb style="margin-bottom:10px">‹ Magazzino</button><div class=card><div class=row style="justify-content:flex-start;gap:14px;align-items:flex-start"><div style="width:${f.k == 'cong' ? 96 : 56}px;flex:none">${mgDraw(f)}</div><div style="flex:1"><b style="font:700 19px Georgia,serif">${esc(f.n)}</b><div class=m>${MGK[f.k]}${f.k == 'frigo' ? (f.a == 2 ? ' · anta doppia' : ' · anta singola') : ''} · ${L.length} prodotti</div>${E ? `<div class="row st" style="margin-top:8px"><button class="g sm" data-a=xefr data-id=${f.id}>Modifica</button><button class="g sm" data-a=xtz data-id=${f.id}>Registro temp.</button><button class="g d sm" data-a=xdf data-id=${f.id}>✕</button></div>` : ''}</div></div></div>`
    + Array.from({length:f.sh}, (_, i) => {
      const s = i + 1, l = L.filter(x => (+x.s || 1) == s);
      return `<div class=card><div class=row><b>${f.k == 'cong' ? nm : nm + ' ' + s}</b><button class="g sm" data-a=xit data-s=${s}>+ Prodotto</button></div>${l.map(row).join('') || '<div class=m>Vuoto</div>'}</div>`;
    }).join('')
    + '<div class=hint>Tocca un prodotto per modificarlo, spostarlo di ripiano o registrarlo come scarto.</div>';
}

// Arrivo merce: carica l'ordine nel magazzino, anche parziale
function mgAr() {
  const L = S.sp.filter(x => x.q > 0), D = $('#d');
  if (!L.length) return tst('L\'ordine è vuoto');
  if (!S.fr.length) return alert('Per caricare la merce serve almeno un frigorifero, una cella o un congelatore nel Magazzino. Aggiungine uno e riprova.');
  const loc = x => { const m = S.pr.find(y => y.n.toLowerCase() == x.n.toLowerCase()); return m && S.fr.find(f => f.id == m.f) ? {f:m.f, s:+m.s || 1} : {f:S.fr[0].id, s:1}; };
  const step1 = () => {
    D.innerHTML = `<h3 style="margin:0 0 6px">Ordine arrivato</h3><div class=m style="margin-bottom:12px">${L.length} prodotti nell'ordine. La merce è arrivata completa o manca qualcosa?</div><div style="display:grid;gap:8px"><button type=button id=dsc>Con lo scanner</button><button type=button class=g data-m=full>Arrivato completo</button><button type=button class=g data-m=part>Con merce mancante</button><button type=button class=g id=dc>Annulla</button></div><div class=m style="margin-top:8px">Con lo scanner inquadri un collo alla volta: lotto e scadenza si leggono dall'etichetta quando il fornitore usa i codici GS1, e l'ordine si aggiorna da solo.</div>`;
    $('#dsc').onclick = () => { D.close(); scMerce(); };
    D.querySelectorAll('[data-m]').forEach(b => b.onclick = () => step2(b.dataset.m));
    $('#dc').onclick = () => D.close();
  };
  const step2 = mode => {
    const part = mode == 'part';
    D.innerHTML = `<h3 style="margin:0 0 4px">${part ? 'Merce arrivata' : 'Ordine completo'}</h3><div class=m style="margin-bottom:8px">${part ? 'Scrivi la quantità arrivata: la parte mancante resta nell\'ordine.' : 'Tutte le quantità ordinate vengono caricate.'} Per ogni prodotto indica dove metterlo, il lotto e la scadenza.</div>`
      + L.map(x => {
        const d0 = loc(x), fu = S.fr.find(f => f.id == d0.f);
        return `<div class=card style="padding:10px;margin-bottom:8px" data-i=${x.id}><div class=row><b>${esc(x.n)}</b><span class=m>ordinati ${x.q} ${esc(x.u)}</span></div>
          ${part ? `<div class=row style="margin-top:6px;gap:8px"><span class=m style="flex:none">Arrivati</span><input data-k=q type=number step=any min=0 inputmode=decimal value="${x.q}" style="margin:0"><span class=m style="flex:none">${esc(x.u)}</span></div>` : ''}
          <div class=row style="margin-top:6px;gap:6px"><select data-k=f style="margin:0;flex:1;min-width:0;width:auto">${S.fr.map(f => `<option value=${f.id} ${f.id == d0.f ? 'selected' : ''}>${esc(f.n)}</option>`).join('')}</select><select data-k=s style="margin:0;flex:0 0 122px;width:122px">${shelves(fu).map((l, i) => `<option value=${i + 1} ${i + 1 == d0.s ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
          <input data-k=l placeholder="Lotto" style="margin-top:6px"><div class=m style="margin-top:2px">Scadenza</div><input data-k=e type=date></div>`;
      }).join('') + `<div class=row style="margin-top:10px"><button type=button class=g id=db>Indietro</button><button type=button id=ds>Carica in magazzino</button></div>`;
    D.querySelectorAll('[data-k=f]').forEach(sel => sel.onchange = () => {
      const f = S.fr.find(y => y.id == sel.value), ss = sel.closest('[data-i]').querySelector('[data-k=s]');
      ss.innerHTML = shelves(f).map((l, i) => `<option value=${i + 1}>${l}</option>`).join('');
    });
    $('#db').onclick = step1;
    $('#ds').onclick = () => {
      const rows = [...D.querySelectorAll('[data-i]')].map(c => {
        const g = k => c.querySelector(`[data-k=${k}]`), it = L.find(x => x.id == c.dataset.i);
        return {it, q:part ? Math.max(0, num(g('q').value)) : it.q, f:g('f').value, s:+g('s').value, l:g('l').value.trim(), e:g('e').value};
      });
      if (!rows.some(r => r.q > 0)) return alert('Inserisci almeno una quantità arrivata.');
      let nAdd = 0, miss = [];
      rows.forEach(r => {
        if (r.q <= 0) return;
        nAdd++;
        const m = S.pr.find(y => y.f == r.f && (+y.s || 1) == r.s && y.n.toLowerCase() == r.it.n.toLowerCase() && y.u == r.it.u && (y.l || '') == r.l && (y.e || '') == r.e);
        if (m) m.q = +(m.q + r.q).toFixed(2);
        else S.pr.push({id:uid(), n:r.it.n, q:+r.q.toFixed(2), u:r.it.u, f:r.f, s:r.s, l:r.l, e:r.e});
      });
      rows.forEach(r => {
        const rest = +(r.it.q - r.q).toFixed(2);
        if (rest > 0) { r.it.q = rest; miss.push(r.it.n); } else S.sp = S.sp.filter(x => x.id != r.it.id);
      });
      act('merce', `Merce arrivata: ${nAdd} prodotti${miss.length ? ' · mancano ' + miss.join(', ') : ''}`);
      save(); D.close();
      tst(nAdd + ' prodotti caricati in magazzino' + (miss.length ? ` · ${miss.length} ancora da ricevere` : ''));
    };
  };
  step1(); D.showModal();
}

function mgSp() {
  const L = S.sp;
  return `<button class=g data-a=xmb style="margin-bottom:10px">‹ Magazzino</button><div class=card><b>Ordine merci</b><div class="row st" style="margin:8px 0"><button data-a=xsa>+ Aggiungi</button><button class=g data-a=xst>Testo</button><button class=g data-a=xsi>Immagine</button></div>`
    + (L.length ? '<button data-a=xar class=w style="margin-bottom:6px">Aggiungi ordine arrivato</button>' : '')
    + (L.map(x => `<div class=li><div class=row><label class=chk style="margin:0;min-width:0"><input type=checkbox data-a=xsk data-id=${x.id} ${x.ok ? 'checked' : ''}><span style="${x.ok ? 'text-decoration:line-through;color:var(--m)' : ''}">${esc(x.n)}</span></label><button class="g d sm" data-a=xsd data-id=${x.id}>✕</button></div><div class="row st" style="margin-top:6px;gap:8px"><button class=g data-a=xsq data-id=${x.id} data-d=-1 style="width:44px">−</button><b data-a=xsE data-id=${x.id} style="min-width:72px;text-align:center;font-size:17px;cursor:pointer">${x.q} <span class=m>${esc(x.u)}</span></b><button class=g data-a=xsq data-id=${x.id} data-d=1 style="width:44px">+</button></div></div>`).join('') || '<div class=m>Ordine vuoto: dal magazzino tocca "Ordina" su un prodotto.</div>')
    + (L.some(x => x.ok) ? '<button class=g data-a=xsc style="margin-top:10px">Rimuovi gli ordinati</button>' : '')
    + `</div><div class=m>Con − e + cambi la quantità, toccandola la scrivi a mano. Spunta ciò che hai già ordinato al fornitore. Condividi l'ordine su WhatsApp come testo o come immagine.</div>`;
}

function vMag() {
  if (mgs == 'spesa') return mgSp();
  if (mgs == 'codici') return mgCod();
  const f = S.fr.find(x => x.id == mgs);
  if (f) return mgUn(f);
  mgs = null;
  const nS = S.sp.filter(x => !x.ok).length;
  return `<button data-a=xscn class=w style="margin-bottom:8px">Scansiona merce</button><div class="row st" style="margin-bottom:10px">${can('edit') ? '<button class=g data-a=xfr>+ Unità</button>' : ''}<button class=g data-a=xsp>Ordine merci${nS ? ` (${nS})` : ''}</button><button class=g data-a=xcod>Codici${S.bc.length ? ` (${S.bc.length})` : ''}</button></div>`
    + (S.fr.length ? `<div class=ug>${S.fr.map(f => {
      const L = S.pr.filter(x => x.f == f.id), al = L.filter(x => x.e && days(x.e) <= 2).length;
      return `<div class="card uc" data-a=xmu data-id=${f.id}><div style="width:${f.k == 'cong' ? '100%' : '58%'};margin:0 auto 6px">${mgDraw(f)}</div><b>${esc(f.n)}</b><div class=m>${MGK[f.k]} · ${L.length} prodotti</div>${al ? `<div class=warn>${al} in scadenza</div>` : ''}</div>`;
    }).join('')}</div>` : `<div class=empty>Nessuna unità${can('edit') ? ': aggiungi frigoriferi, celle e congelatori della tua cucina, poi inserisci i prodotti ripiano per ripiano.' : '.'}</div>`);
}

const go2 = s => { mgs = s; draw(); scrollTo(0, 0); };
Object.assign(A, {
  xfr: () => mgFr(), xefr: id => mgFr(id), xmu: id => go2(id), xmb: () => go2(null), xsp: () => go2('spesa'),
  xdf: id => { if (confirm('Eliminare questa unità e i suoi prodotti?')) { S.fr = S.fr.filter(x => x.id != id); S.pr = S.pr.filter(x => x.f != id); mgs = null; save(); draw(); } },
  xit: (id, el) => mgIt(null, mgs, +el.dataset.s), xei: id => mgIt(id),
  xqm: id => { const p = S.pr.find(x => x.id == id); p.q = Math.max(0, +(p.q - 1).toFixed(2)); save(); draw(); },
  xqp: id => { const p = S.pr.find(x => x.id == id); p.q = +(p.q + 1).toFixed(2); save(); draw(); },
  xcs: id => {
    const p = S.pr.find(x => x.id == id), e = S.sp.find(x => !x.ok && x.n.toLowerCase() == p.n.toLowerCase());
    if (e) { e.q = +(e.q + 1).toFixed(2); save(); return tst(p.n + ': ora ' + e.q + ' ' + e.u); }
    S.sp.push({id:uid(), n:p.n, q:1, u:p.u, ok:0}); save(); tst(p.n + ' aggiunto all\'ordine');
  },
  xtz: id => {
    const f = S.fr.find(x => x.id == id);
    if (S.u.some(z => z.n == f.n)) return tst('Già nel registro temperature');
    S.u.push({id:uid(), n:f.n, a:f.k == 'cong' ? -25 : 0, b:f.k == 'cong' ? -18 : 4}); save(); tst('Aggiunto al registro temperature');
  },
  xsa: () => mgSpE(), xar: () => mgAr(),
  xsq: (id, el) => { const x = S.sp.find(y => y.id == id), st = ['g','ml'].includes(x.u) ? 100 : 1; x.q = Math.max(0, +(x.q + st * +el.dataset.d).toFixed(2)); save(); draw(); },
  xsE: id => { const x = S.sp.find(y => y.id == id), r = prompt('Quantità (' + x.u + ')', x.q); if (r === null) return; const q = num(r); if (q < 0) return; x.q = q; save(); draw(); },
  xsk: (id, el) => { S.sp.find(x => x.id == id).ok = el.checked ? 1 : 0; save(); draw(); },
  xsd: id => { S.sp = S.sp.filter(x => x.id != id); save(); draw(); },
  xsc: () => { S.sp = S.sp.filter(x => !x.ok); save(); draw(); },
  xst: () => shareText(mgTxt()), xsi: () => mgImg()
});
