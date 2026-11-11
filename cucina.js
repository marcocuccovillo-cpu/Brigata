// Brigata — Cucina: ricette, ingredienti, menù allergeni (con QR) e scarti
'use strict';

const CAT = ['Antipasti','Primi','Secondi','Contorni','Pizze','Dolci','Bevande','Altro'];
const ig = id => S.ing.find(x => x.id == id);
const cost = r => r.items.reduce((s, x) => { const i = ig(x.i); return i ? s + (i.u == 'pz' ? x.q * (i.p || 0) : x.q / 1000 * (i.p || 0)) : s; }, 0);
const als = r => [...new Set(r.items.flatMap(x => (ig(x.i) || {al:[]}).al))].sort((a, b) => a - b);
const qU = i => i.u == 'pz' ? 'pz' : i.u == 'kg' ? 'g' : 'ml';
let sub = 'rec';

function vCuc() {
  const V = {rec:vR, ing:vI, men:vM, sca:vS};
  if (!V[sub]) sub = 'rec';
  return `<div class=sg>${[['rec','Ricette'],['ing','Ingredienti'],['men','Menù'],['sca','Scarti']].map(([k, l]) => `<button data-a=xsub data-id=${k} class="${k == sub ? 'on' : ''}">${l}</button>`).join('')}</div>` + V[sub]();
}

// ---------- Ingredienti ----------
function eIng(id) {
  const n = !id, i = ig(id) || {id:uid(), n:'', p:0, u:'kg', al:[], f:''};
  ed(n ? 'Nuovo ingrediente' : 'Ingrediente',
    `<input name=n placeholder="Nome" value="${esc(i.n)}">
     <div class=row><input name=p type=number step=0.01 inputmode=decimal placeholder="Prezzo €" value="${i.p || ''}"><select name=u>${['kg','l','pz'].map(u => `<option ${u == i.u ? 'selected' : ''}>${u}</option>`).join('')}</select></div>
     <input name=f placeholder="Fornitore" value="${esc(i.f)}">
     <div class=m>Allergeni presenti</div>${AL.map((a, k) => `<label class=chk><input type=checkbox value=${k} ${i.al.includes(k) ? 'checked' : ''}>${a}</label>`).join('')}`,
    d => {
      const nm = v(d, 'n').trim(); if (!nm) return false;
      if (S.ing.some(x => x.id != i.id && x.n.toLowerCase() == nm.toLowerCase()) && !confirm('Esiste già un ingrediente "' + nm + '". Salvare comunque?')) return false;
      Object.assign(i, {n:nm, p:num(v(d, 'p')), u:v(d, 'u'), f:v(d, 'f').trim(), al:[...d.querySelectorAll('.chk input:checked')].map(c => +c.value)});
      if (n) S.ing.push(i);
    });
}

function vI() {
  const E = can('edit'), C = can('cost');
  const L = [...S.ing].sort((a, b) => a.n.localeCompare(b.n));
  return (E ? `<button data-a=ni class=w style="margin-bottom:10px">+ Nuovo ingrediente</button>` : '')
    + (L.map(i => `<div class=card><div class=row><b>${esc(i.n)}</b>${C ? `<span>${eur(i.p)}/${i.u}</span>` : `<span class=m>${i.u}</span>`}</div>${i.f ? `<div class=m>${esc(i.f)}</div>` : ''}${tags(i.al)}${E ? `<div class=row style="margin-top:8px"><button class=g data-a=ei data-id=${i.id}>Modifica</button><button class="g d" data-a=di data-id=${i.id}>Elimina</button></div>` : ''}</div>`).join('')
    || `<div class=empty>${E ? 'Inizia dagli ingredienti: prezzo e allergeni alimentano tutto il resto.' : 'Nessun ingrediente inserito.'}</div>`);
}

// ---------- Ricette ----------
function eRec(id) {
  if (!S.ing.length) return alert('Aggiungi prima almeno un ingrediente.');
  const n = !id, r = S.rec.find(x => x.id == id) || {id:uid(), n:'', s:1, fc:30, pv:0, items:[], cat:'', mn:1};
  const row = x => `<div class="row it"><select>${[...S.ing].sort((a, b) => a.n.localeCompare(b.n)).map(i => `<option value=${i.id} ${i.id == x.i ? 'selected' : ''}>${esc(i.n)} (${qU(i)})</option>`).join('')}</select><input type=number step=any inputmode=decimal placeholder="Qtà" value="${x.q || ''}" style="width:90px"><button type=button class="g d sm" data-rm>✕</button></div>`;
  ed(n ? 'Nuova ricetta' : 'Ricetta',
    `<input name=n placeholder="Nome piatto" value="${esc(r.n)}">
     <div class=row><input name=s type=number min=1 inputmode=numeric placeholder="Porzioni" value="${r.s}"><input name=fc type=number inputmode=decimal placeholder="Food cost target %" value="${r.fc}"></div>
     <input name=pv type=number step=0.01 inputmode=decimal placeholder="Prezzo di vendita € (facoltativo)" value="${r.pv || ''}">
     <div class=row><select name=cat><option value="">Categoria…</option>${CAT.map(c => `<option ${c == r.cat ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
     <label class=chk><input type=checkbox name=mn ${r.mn ? 'checked' : ''}>Piatto del menù clienti (togli la spunta per le basi: fondi, salse, impasti…)</label>
     <div class=m style="margin-top:6px">Ingredienti: quantità totale della ricetta (g, ml o pezzi)</div><div id=its>${r.items.map(row).join('')}</div>
     <button type=button class=g id=ad>+ Ingrediente</button>
     <textarea name=pr rows=3 placeholder="Procedimento / note (facoltativo)">${esc(r.pr || '')}</textarea>`,
    d => {
      if (!v(d, 'n').trim()) return false;
      Object.assign(r, {n:v(d, 'n').trim(), s:Math.max(1, +v(d, 's') || 1), fc:num(v(d, 'fc')) || 30, pv:num(v(d, 'pv')), cat:v(d, 'cat'), mn:d.querySelector('[name=mn]').checked ? 1 : 0, pr:v(d, 'pr').trim(),
        items:[...d.querySelectorAll('.it')].map(e => ({i:e.querySelector('select').value, q:num(e.querySelector('input').value)})).filter(x => x.q > 0)});
      if (n) S.rec.push(r);
      act('ricetta', (n ? 'Nuova ricetta: ' : 'Ricetta modificata: ') + r.n);
    });
  const its = $('#its');
  $('#ad').onclick = () => its.insertAdjacentHTML('beforeend', row({}));
  its.onclick = e => { if (e.target.closest('[data-rm]')) e.target.closest('.it').remove(); };
  if (!r.items.length) $('#ad').click();
  if (!can('cost')) ['fc','pv'].forEach(k => { const e = $(`#d [name=${k}]`); if (e) e.style.display = 'none'; });
}

function vR() {
  const E = can('edit'), C = can('cost');
  return (E ? `<button data-a=nr class=w style="margin-bottom:10px">+ Nuova ricetta</button>` : '')
    + (S.rec.map(r => {
      const c = cost(r), cp = c / r.s, sug = cp / (r.fc / 100), fr = r.pv ? cp / r.pv * 100 : 0;
      return `<div class=card data-a=vrc data-id=${r.id} style="cursor:pointer"><div class=row><b>${esc(r.n)}</b><span class=m>${r.cat ? esc(r.cat) + ' · ' : ''}${r.s} porz.</span></div>`
        + (C ? `<div class=m>Costo ricetta ${eur(c)} · per porzione <b>${eur(cp)}</b></div><div>Prezzo consigliato (food cost ${r.fc}%): <b>${eur(sug)}</b></div>${r.pv ? `<div class="${fr > r.fc ? 'bad' : 'ok'}">Food cost reale ${fr.toFixed(1)}% · margine ${eur(r.pv - cp)}</div>` : ''}` : `<div class=m>${r.items.length} ingredienti${r.mn ? '' : ' · preparazione di base'}</div>`)
        + tags(als(r))
        + (E ? `<div class=row style="margin-top:8px"><button class=g data-a=er data-id=${r.id}>Modifica</button><button class="g d" data-a=dr data-id=${r.id}>Elimina</button></div>` : '')
        + `</div>`;
    }).join('') || `<div class=empty>${E ? 'Crea una ricetta: costo e allergeni si calcolano da soli.' : 'Nessuna ricetta inserita.'}</div>`);
}

// Scheda ricetta con quantità riproporzionate
function recCard(id) {
  const r = S.rec.find(x => x.id == id); if (!r) return;
  const D = $('#d'), C = can('cost');
  const paint = p => {
    const k = p / r.s;
    D.innerHTML = `<div class=row><h3 style="margin:0">${esc(r.n)}</h3><button class=g data-a=gcl>Chiudi</button></div>
      <div class=row style="margin:10px 0;justify-content:flex-start"><span class=m>Porzioni</span><button type=button class="g sm" id=pm>−</button><b style="min-width:30px;text-align:center">${p}</b><button type=button class="g sm" id=pp>+</button>${p != r.s ? `<span class=m>(ricetta base: ${r.s})</span>` : ''}</div>
      <table>${r.items.map(x => { const i = ig(x.i); if (!i) return ''; const q = x.q * k, u = qU(i); return `<tr><td>${esc(i.n)}</td><td style="text-align:right"><b>${+q.toFixed(u == 'pz' ? 1 : 0)}</b> ${u}</td>${C ? `<td class=m style="text-align:right">${eur(i.u == 'pz' ? q * i.p : q / 1000 * i.p)}</td>` : ''}</tr>`; }).join('')}</table>
      ${C ? `<div class=m style="margin-top:6px">Costo totale ${eur(cost(r) * k)} · per porzione ${eur(cost(r) / r.s)}</div>` : ''}
      <div style="margin-top:8px">${als(r).length ? tags(als(r)) : '<span class=m>Nessun allergene dichiarato</span>'}</div>
      ${r.pr ? `<div class=m style="margin-top:12px">Procedimento</div><div style="white-space:pre-wrap">${esc(r.pr)}</div>` : ''}`;
    $('#pm').onclick = () => paint(Math.max(1, p - 1));
    $('#pp').onclick = () => paint(p + 1);
  };
  paint(r.s);
  if (!D.open) D.showModal();
}

// ---------- Menù allergeni ----------
const menuDishes = () => S.rec.filter(r => r.mn).sort((a, b) => ((CAT.indexOf(a.cat) + 1 || 99) - (CAT.indexOf(b.cat) + 1 || 99)) || a.n.localeCompare(b.n));
const menuData = () => ({n:S.loc || '', logo:S.logo || '', upd:today(), d:menuDishes().map(r => ({n:r.n, c:r.cat || '', al:als(r)}))});
const menuUrl = slug => new URL('menu.html?m=' + slug, location.href).href;

function vM() {
  let cat = null;
  const L = menuDishes();
  const list = L.map(r => {
    const a = als(r), h = r.cat != cat && r.cat ? `<h3 class=sub>${esc(r.cat)}</h3>` : '';
    cat = r.cat;
    return h + `<div class=card><b>${esc(r.n)}</b><div>${a.length ? tags(a) : '<span class=ok>Nessun allergene dichiarato</span>'}</div></div>`;
  }).join('');
  return pubCard()
    + `<div class="card np"><div class=m>Tabella allergeni (Reg. UE 1169/2011) calcolata dagli ingredienti. Verifica sempre le etichette dei prodotti.</div><div class=row style="margin-top:8px"><button data-a=print>Stampa / PDF</button><button class=g data-a=share>Condividi testo</button></div></div>`
    + (S.logo ? `<img src="${S.logo}" alt="" style="height:64px">` : '') + (S.loc ? `<h2>${esc(S.loc)}</h2>` : '')
    + (list || '<div class=empty>Nessun piatto del menù: aggiungi le ricette.</div>');
}

function pubCard() {
  if (!can('edit')) return '';
  const P = S.pub || {};
  if (!Cloud.rid) return `<div class="card np"><b>Menù digitale con QR</b><div class=m style="margin-top:4px">I clienti inquadrano il QR sul tavolo e vedono i piatti con i loro allergeni, in italiano, inglese e tedesco. Per pubblicarlo serve l'account del ristorante: vai in <b>Staff</b>.</div></div>`;
  if (!P.on) return `<div class="card np"><b>Menù digitale con QR</b><div class=m style="margin:4px 0 8px">I clienti inquadrano il QR e vedono i piatti con gli allergeni in italiano, inglese e tedesco. Si aggiorna da solo quando cambi le ricette.</div><button data-a=pubon>Pubblica il menù digitale</button></div>`;
  const u = menuUrl(P.slug), st = Cloud.pubState();
  return `<div class="card np"><b>Menù digitale con QR</b><div class=m>${st}</div>
    <div class=qr><canvas data-qr="${esc(u)}"></canvas><div><div class=lnk>${esc(u)}</div><div class=row st style="margin-top:8px"><button class=sm data-a=pubqr>Scarica QR</button><button class="g sm" data-a=publk>Condividi link</button><button class="g d sm" data-a=puboff>Ritira</button></div></div></div></div>`;
}

const txt = () => (S.loc ? S.loc + '\n' : '') + 'Allergeni:\n' + menuDishes().map(r => r.n + ': ' + (als(r).map(k => AL[k]).join(', ') || 'nessuno')).join('\n');

function qrPng() {
  const u = menuUrl(S.pub.slug), m = qrMatrix(u), n = m.length, sc = 14, q = 4, W = (n + q * 2) * sc, H = W + 150;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#14120e';
  m.forEach((r, y) => r.forEach((b, x) => { if (b) g.fillRect((x + q) * sc, (y + q) * sc, sc, sc); }));
  g.textAlign = 'center';
  g.font = 'bold 34px Georgia,serif'; g.fillText(S.loc || 'Menù', W / 2, W + 40);
  g.fillStyle = '#8a6a1c'; g.font = '24px system-ui,sans-serif'; g.fillText('Menù e allergeni · Menu & allergens', W / 2, W + 80);
  g.fillStyle = '#6f6753'; g.font = '20px system-ui,sans-serif'; g.fillText('Inquadra con la fotocamera', W / 2, W + 115);
  shareCanvas(c, 'qr-menu.png');
}

// ---------- Scarti di produzione ----------
const MOT = ['Pulizia e rifilatura','Errore di preparazione','Scaduto / deteriorato','Avanzo di servizio','Rottura o caduta','Altro'];
const SCU = ['g','kg','ml','l','pz'];
let scF = 'all';

// valore stimato di uno scarto (solo se legato a un ingrediente con prezzo)
function scVal(x) {
  const i = x.i && ig(x.i); if (!i || !i.p) return null;
  const q = +x.q || 0;
  if (i.u == 'pz') return x.u == 'pz' ? q * i.p : null;
  if (x.u == 'g' || x.u == 'ml') return q / 1000 * i.p;
  if (x.u == 'kg' || x.u == 'l') return q * i.p;
  return null;
}
const scKg = x => x.u == 'kg' || x.u == 'l' ? +x.q : x.u == 'g' || x.u == 'ml' ? x.q / 1000 : 0;

function eSc(id, pre, after) {
  const n = !id, x = S.sc.find(y => y.id == id) || Object.assign({id:uid(), d:today(), h:hm(), n:'', q:'', u:'g', mot:MOT[0], dest:'b', uso:'', x:'', by:me()}, pre || {});
  const names = [...new Set([...S.ing.map(i => i.n), ...S.pr.map(p => p.n)])].sort();
  const usi = [...new Set(S.sc.map(y => y.uso).filter(Boolean))];
  ed(n ? 'Registra scarto' : 'Scarto',
    `<input name=n list=scn placeholder="Prodotto (es. Carciofi, Branzino…)" value="${esc(x.n)}"><datalist id=scn>${names.map(t => `<option value="${esc(t)}">`).join('')}</datalist>
     <div class=row><input name=q type=number step=any min=0 inputmode=decimal placeholder="Quantità" value="${x.q}"><select name=u style="width:110px">${SCU.map(u => `<option ${u == x.u ? 'selected' : ''}>${u}</option>`).join('')}</select></div>
     <select name=mot>${MOT.map(m => `<option ${m == x.mot ? 'selected' : ''}>${m}</option>`).join('')}</select>
     <div class=sg style="margin:8px 0"><button type=button data-dest=b class="${x.dest == 'b' ? 'on' : ''}">Buttato</button><button type=button data-dest=r class="${x.dest == 'r' ? 'on' : ''}">Recuperato</button></div>
     <div id=usoW style="display:${x.dest == 'r' ? 'block' : 'none'}"><input name=uso list=scu placeholder="Usato per (es. brodo, pasto del personale…)" value="${esc(x.uso)}"><datalist id=scu>${usi.map(t => `<option value="${esc(t)}">`).join('')}</datalist></div>
     <div class=row><input name=d type=date value="${x.d}"><input name=x placeholder="Note (facoltative)" value="${esc(x.x)}"></div>`,
    d => {
      const nm = v(d, 'n').trim(), q = num(v(d, 'q'));
      if (!nm || !(q > 0)) { alert('Scrivi il prodotto e la quantità.'); return false; }
      const dest = d.querySelector('[data-dest].on').dataset.dest;
      if (dest == 'r' && !v(d, 'uso').trim()) { alert('Scrivi per cosa è stato recuperato.'); return false; }
      const i = S.ing.find(y => y.n.toLowerCase() == nm.toLowerCase());
      Object.assign(x, {n:nm, q, u:v(d, 'u'), mot:v(d, 'mot'), dest, uso:dest == 'r' ? v(d, 'uso').trim() : '', d:v(d, 'd') || today(), x:v(d, 'x').trim(), i:i ? i.id : ''});
      if (n) { S.sc.push(x); act('scarto', `${x.n} ${x.q} ${x.u} · ${dest == 'b' ? 'buttato (' + x.mot.toLowerCase() + ')' : 'recuperato per ' + x.uso}`); }
      if (after) after(x);
    }, n ? '' : `<button type=button class="g d" id=scx>Elimina</button>`);
  const D = $('#d');
  D.querySelectorAll('[data-dest]').forEach(b => b.onclick = () => {
    D.querySelectorAll('[data-dest]').forEach(o => o.classList.toggle('on', o == b));
    $('#usoW').style.display = b.dataset.dest == 'r' ? 'block' : 'none';
  });
  if (!n) $('#scx').onclick = () => { if (confirm('Eliminare questo scarto?')) { S.sc = S.sc.filter(y => y.id != x.id); save(); D.close(); } };
}

function vS() {
  const C = can('cost'), D = today(), mo = D.slice(0, 7);
  const M = S.sc.filter(x => x.d.slice(0, 7) == mo), L30 = S.sc.filter(x => days(x.d) >= -30);
  const sum = (L, f) => L.reduce((a, x) => a + (f(x) || 0), 0);
  const bt = M.filter(x => x.dest == 'b'), rc = M.filter(x => x.dest == 'r');
  const top = Object.entries(L30.reduce((o, x) => { const k = x.n.toLowerCase(); (o[k] = o[k] || {n:x.n, c:0, b:0}).c++; if (x.dest == 'b') o[k].b++; return o; }, {})).map(e => e[1]).sort((a, b) => b.c - a.c).slice(0, 5);
  const uses = Object.entries(L30.filter(x => x.dest == 'r').reduce((o, x) => { o[x.uso] = (o[x.uso] || 0) + 1; return o; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const L = [...S.sc].filter(x => scF == 'all' || x.dest == scF).sort((a, b) => (b.d + (b.h || '')).localeCompare(a.d + (a.h || ''))).slice(0, 80);
  let lastD = null;
  return `<button data-a=nsc class=w style="margin-bottom:10px">+ Registra scarto</button>`
    + `<div class=card><b>${new Date(D + 'T12:00').toLocaleDateString('it', {month:'long', year:'numeric'})}</b>
       <div class=kpi><div><b>${M.length}</b><span>registrazioni</span></div><div><b>${bt.length}</b><span>buttati</span>${sum(bt, scKg) ? `<span>${+sum(bt, scKg).toFixed(1)} kg</span>` : ''}</div><div><b>${rc.length}</b><span>recuperati</span>${sum(rc, scKg) ? `<span>${+sum(rc, scKg).toFixed(1)} kg</span>` : ''}</div></div>
       ${C && (sum(bt, scVal) || sum(rc, scVal)) ? `<div class=m style="margin-top:8px">Valore stimato buttato <b class=bad>${eur(sum(bt, scVal))}</b> · recuperato <b>${eur(sum(rc, scVal))}</b></div>` : ''}
       ${C ? '<div class=hint>Il valore si calcola sugli scarti con lo stesso nome di un ingrediente che ha un prezzo.</div>' : ''}</div>`
    + (top.length ? `<div class=card><b>Più scartati negli ultimi 30 giorni</b>${top.map(t => `<div style="margin-top:8px"><div class=row><span>${esc(t.n)}</span><span class=m>${t.c} volte${t.b ? ` · ${t.b} buttati` : ''}</span></div><div class=bar><i style="width:${Math.round(t.c / top[0].c * 100)}%"></i></div></div>`).join('')}
       ${uses.length ? `<div class=m style="margin-top:12px">Recuperi più frequenti: ${uses.map(([u, c]) => `<b>${esc(u)}</b> (${c})`).join(' · ')}</div>` : ''}</div>` : '')
    + `<div class=sg>${[['all','Tutti'],['b','Buttati'],['r','Recuperati']].map(([k, l]) => `<button data-a=scf data-id=${k} class="${k == scF ? 'on' : ''}">${l}</button>`).join('')}</div>`
    + (L.map(x => {
      const h = x.d != lastD ? `<div class=m style="margin:12px 2px 4px"><b>${fd(x.d)}</b></div>` : '';
      lastD = x.d;
      const val = C ? scVal(x) : null;
      return h + `<div class=card data-a=sce data-id=${x.id} style="padding:10px 12px;margin-bottom:6px;cursor:pointer"><div class=row><b>${esc(x.n)}</b><span>${x.q} ${esc(x.u)}</span></div>
        <div class=row style="margin-top:3px"><span class=m>${x.dest == 'b' ? '<span class="pill b">Buttato</span> ' + esc(x.mot) : '<span class="pill r">Recuperato</span> per ' + esc(x.uso)}</span><span class=m>${val != null ? eur(val) : ''}</span></div>
        ${x.by || x.x ? `<div class=m style="font-size:12px;margin-top:2px">${esc([x.by, x.x].filter(Boolean).join(' · '))}</div>` : ''}</div>`;
    }).join('') || '<div class=empty>Nessuno scarto registrato. Segna cosa si butta e cosa si recupera in produzione: dopo qualche settimana vedi dove si perde di più.</div>');
}

Object.assign(A, {
  ni: () => eIng(), ei: id => eIng(id), di: id => del('ing', id),
  nr: () => eRec(), er: id => eRec(id), dr: id => del('rec', id), vrc: id => recCard(id),
  xsub: id => { sub = id; draw(); },
  share: () => shareText(txt()),
  pubon: () => { if (!confirm('Pubblicare il menù con gli allergeni? Chi ha il link o il QR potrà vederlo (solo nomi dei piatti e allergeni, niente prezzi o ricette).')) return; S.pub = {on:1, slug:(S.pub && S.pub.slug) || uid() + uid().slice(0, 4)}; save(); act('menu', 'Menù digitale pubblicato'); draw(); },
  puboff: () => { if (!confirm('Ritirare il menù digitale? Il QR smetterà di funzionare finché non lo ripubblichi.')) return; S.pub.on = 0; save(); act('menu', 'Menù digitale ritirato'); draw(); },
  pubqr: () => qrPng(),
  publk: () => shareText((S.loc ? S.loc + ' — ' : '') + 'Menù e allergeni: ' + menuUrl(S.pub.slug)),
  nsc: () => eSc(), sce: id => eSc(id), scf: id => { scF = id; draw(); }
});
