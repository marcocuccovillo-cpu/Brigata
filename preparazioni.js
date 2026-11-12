// Brigata — preparazioni (semilavorati) messe in magazzino
// Fondi, salse, impasti, sottovuoti… con data di produzione, scadenza e chi le ha fatte.
// Brigata ricorda per ogni preparazione quantità, contenitore, durata e posizione abituali.
'use strict';

const PPQ = [0.5, 1, 2, 3, 5, 10];
const PPU = ['kg','l','pz','porzioni','GN 1/1','GN 1/2','GN 1/3','GN 1/4','GN 1/6','vaschette','sottovuoto'];
const PPG = [1, 2, 3, 5, 7, 30, 90];
const ppKey = n => n.trim().toLowerCase();

function ePrep(id, fid, sh) {
  if (!S.fr.length) return alert('Per mettere una preparazione in magazzino serve almeno un frigorifero, una cella o un congelatore. Aggiungine uno in Magazzino.');
  const n = !id, p = S.pr.find(x => x.id == id) || {id:uid(), n:'', q:1, u:'kg', f:fid || '', s:sh || 1, l:'', e:'', pp:1, d:today(), h:hm(), by:me(), r:''};
  const names = [...new Set([...S.pp.map(x => x.n), ...S.rec.map(r => r.n)])].sort((a, b) => a.localeCompare(b));
  const g0 = n ? 3 : p.e && p.d ? Math.max(0, days(p.e) - days(p.d)) : 3;
  const fr0 = S.fr.find(f => f.id == p.f) || S.fr[0];
  const chips = (L, cur, attr, fmt) => L.map(x => `<button type=button class="sm ${String(x) == String(cur) ? '' : 'g'}" data-${attr}="${esc(x)}" style="margin:3px 4px 0 0">${fmt ? fmt(x) : esc(x)}</button>`).join('');
  ed(n ? 'Nuova preparazione' : 'Preparazione',
    `<input name=n list=ppl placeholder="Preparazione (es. Fondo bruno, Ragù, Crema pasticcera)" value="${esc(p.n)}"><datalist id=ppl>${names.map(t => `<option value="${esc(t)}">`).join('')}</datalist>
     <div id=ppal class=m></div>
     <div class=m style="margin-top:8px">Quantità</div>
     <div id=ppq>${chips(PPQ, p.q, 'q', x => String(x).replace('.', ','))}</div>
     <div class=row style="margin-top:6px"><input name=q type=number step=any min=0 inputmode=decimal value="${p.q}"><select name=u style="width:150px">${[...new Set([...PPU, p.u])].map(u => `<option ${u == p.u ? 'selected' : ''}>${esc(u)}</option>`).join('')}<option value="__">Altro…</option></select></div>
     <input name=uc placeholder="Altro contenitore o unità (es. secchiello 5 l)" style="display:none">
     <div class=m style="margin-top:8px">Dove</div>
     <div class=row style="gap:6px"><select name=f style="flex:1;min-width:0;width:auto">${S.fr.map(f => `<option value=${f.id} ${f.id == fr0.id ? 'selected' : ''}>${esc(f.n)}</option>`).join('')}</select><select name=s style="flex:0 0 122px;width:122px">${shelves(fr0).map((l, i) => `<option value=${i + 1} ${i + 1 == (+p.s || 1) ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
     <div class=row style="margin-top:8px"><div style="flex:1;min-width:0"><div class=m>Prodotta il</div><input name=d type=date value="${p.d || today()}"></div><div style="flex:1;min-width:0"><div class=m>Scade il</div><input name=e type=date value="${p.e || trD(p.d || today(), g0)}"></div></div>
     <div id=ppg>${chips(PPG, g0, 'g', x => x + (x == 1 ? ' giorno' : ' giorni'))}</div>
     <input name=l placeholder="Note / lotto interno (facoltativo)" value="${esc(p.l || '')}">`,
    d => {
      const nm = v(d, 'n').trim(), q = num(v(d, 'q'));
      const u = v(d, 'u') == '__' ? v(d, 'uc').trim() : v(d, 'u');
      if (!nm || !(q > 0) || !u) { alert('Scrivi la preparazione, la quantità e l\'unità.'); return false; }
      if (!v(d, 'e')) { alert('Scegli la scadenza.'); return false; }
      if (v(d, 'e') < v(d, 'd')) { alert('La scadenza è prima della data di produzione.'); return false; }
      const r = S.rec.find(x => x.n.toLowerCase() == nm.toLowerCase());
      Object.assign(p, {n:nm, q:+q.toFixed(3), u, f:v(d, 'f'), s:+v(d, 's') || 1, d:v(d, 'd'), e:v(d, 'e'), l:v(d, 'l').trim(), r:r ? r.id : '', pp:1});
      if (n) { p.h = hm(); p.by = me(); S.pr.push(p); }
      // memoria della preparazione per la prossima volta
      const g = days(p.e) - days(p.d), k = ppKey(nm), m = S.pp.find(x => x.id == k);
      const mem = {n:nm, q:p.q, u, g, f:p.f, s:p.s};
      if (m) Object.assign(m, mem); else S.pp.push({id:k, ...mem});
      const fu = S.fr.find(x => x.id == p.f);
      if (n) act('prep', `${nm} ${p.q} ${u} · ${fu ? fu.n : ''} · scade ${dm(p.e)}`);
    },
    n ? '' : `<button type=button class="g d" id=ppx>Elimina</button><button type=button class=g id=pps>Scarto</button>`);

  const D = $('#d'), f = k => D.querySelector(`[name=${k}]`);
  const mark = (box, attr, val) => box.querySelectorAll(`[data-${attr}]`).forEach(b => b.className = 'sm ' + (String(b.dataset[attr]) == String(val) ? '' : 'g'));
  const setG = g => { f('e').value = trD(f('d').value || today(), g); mark($('#ppg'), 'g', g); };
  const syncG = () => mark($('#ppg'), 'g', f('e').value && f('d').value ? days(f('e').value) - days(f('d').value) : '');
  const alInfo = () => {
    const r = S.rec.find(x => x.n.toLowerCase() == f('n').value.trim().toLowerCase());
    $('#ppal').innerHTML = r ? (als(r).length ? 'Allergeni: ' + tags(als(r)) : 'Nessun allergene dichiarato nella ricetta') : '';
  };
  // scegliendo una preparazione già fatta, propone quantità, unità, durata e posto abituali
  f('n').oninput = () => {
    alInfo();
    if (!n) return;
    const m = S.pp.find(x => x.id == ppKey(f('n').value));
    if (!m) return;
    f('q').value = m.q; mark($('#ppq'), 'q', m.q);
    if (![...f('u').options].some(o => o.value == m.u)) f('u').insertAdjacentHTML('afterbegin', `<option>${esc(m.u)}</option>`);
    f('u').value = m.u;
    if (S.fr.some(x => x.id == m.f)) { f('f').value = m.f; f('f').onchange(); f('s').value = m.s; }
    setG(m.g);
  };
  $('#ppq').onclick = e => { const b = e.target.closest('[data-q]'); if (b) { f('q').value = b.dataset.q; mark($('#ppq'), 'q', b.dataset.q); } };
  f('q').oninput = () => mark($('#ppq'), 'q', f('q').value);
  f('u').onchange = () => { f('uc').style.display = f('u').value == '__' ? 'block' : 'none'; if (f('u').value == '__') f('uc').focus(); };
  f('f').onchange = () => { const fu = S.fr.find(x => x.id == f('f').value); f('s').innerHTML = shelves(fu).map((l, i) => `<option value=${i + 1}>${l}</option>`).join(''); };
  $('#ppg').onclick = e => { const b = e.target.closest('[data-g]'); if (b) setG(+b.dataset.g); };
  f('e').onchange = syncG;
  f('d').onchange = () => { const b = $('#ppg [data-g]:not(.g)'); if (b) setG(+b.dataset.g); };
  alInfo();
  if (!n) {
    $('#ppx').onclick = () => { if (confirm('Eliminare ' + p.n + '?')) { S.pr = S.pr.filter(x => x.id != p.id); save(); D.close(); } };
    $('#pps').onclick = () => {
      const u = ['kg','g','l','ml','pz'].includes(p.u) ? p.u : 'pz';
      eSc(null, {n:p.n, q:'', u, mot:p.e && days(p.e) < 0 ? 'Scaduto / deteriorato' : 'Avanzo di servizio'}, x => {
        if (x.u == p.u) { p.q = Math.max(0, +(p.q - x.q).toFixed(3)); tst(`${p.n}: restano ${p.q} ${p.u}`); }
      });
    };
  }
}

Object.assign(A, {xpp: () => ePrep(null, mgs && S.fr.some(f => f.id == mgs) ? mgs : ''), xpps: (id, el) => ePrep(null, mgs, +el.dataset.s), xepp: id => ePrep(id)});
