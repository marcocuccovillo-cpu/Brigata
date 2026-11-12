// Brigata — manutenzioni, guasti, tarature e controllo infestanti
'use strict';

const MTT = {
  g: {l:'Guasto', ic:'⚠'},
  i: {l:'Intervento tecnico', ic:'🔧'},
  t: {l:'Taratura termometri', ic:'🌡'},
  p: {l:'Controllo infestanti', ic:'🪤'},
  a: {l:'Altro', ic:'•'}
};
const MTW = 15;   // giorni di preavviso per le scadenze
const mtObjs = () => [...new Set([...S.fr.map(f => f.n), ...S.u.map(u => u.n), 'Termometro a sonda', 'Abbattitore', 'Lavastoviglie', 'Forno', 'Cappa'])].sort((a, b) => a.localeCompare(b));
const mtOpen = () => S.mt.filter(m => m.ty == 'g' && !m.rs);
// prossima scadenza di ogni controllo periodico: vale l'ultima registrazione dello stesso tipo e attrezzatura
function mtDue() {
  const last = {};
  S.mt.filter(m => m.ty != 'g').forEach(m => { const k = m.ty + '|' + (m.o || '').toLowerCase(); if (!last[k] || m.d > last[k].d) last[k] = m; });
  return Object.values(last).filter(m => m.sc).sort((a, b) => a.sc.localeCompare(b.sc));
}
const mtAlert = () => mtOpen().length + mtDue().filter(m => days(m.sc) <= MTW).length;

function eMt(id, ty0) {
  const n = !id, m = S.mt.find(x => x.id == id) || {id:uid(), ty:ty0 || 'g', o:'', d:today(), x:'', chi:'', sc:'', rs:'', by:me()};
  const addM = k => { const x = new Date((v($('#d'), 'd') || today()) + 'T12:00'); x.setMonth(x.getMonth() + k); return x.toLocaleDateString('sv'); };
  ed(n ? 'Nuova registrazione' : MTT[m.ty].l,
    `<div class=sg style="flex-wrap:wrap">${Object.entries(MTT).map(([k, t]) => `<button type=button data-ty=${k} class="${k == m.ty ? 'on' : ''}" style="flex:1 0 30%">${t.l}</button>`).join('')}</div>
     <input name=o list=mto placeholder="Attrezzatura (es. Frigo carni, Termometro a sonda)" value="${esc(m.o)}"><datalist id=mto>${mtObjs().map(t => `<option value="${esc(t)}">`).join('')}</datalist>
     <div class=row><div style="flex:1;min-width:0"><div class=m>Data</div><input name=d type=date value="${m.d}"></div><div style="flex:1;min-width:0" id=scw><div class=m>Prossima scadenza</div><input name=sc type=date value="${m.sc}"></div></div>
     <div id=scq>${[1, 3, 6, 12].map(k => `<button type=button class="g sm" data-mm=${k} style="margin:3px 4px 0 0">+${k} ${k == 1 ? 'mese' : 'mesi'}</button>`).join('')}</div>
     <textarea name=x rows=3 placeholder="Cosa è successo / cosa è stato fatto">${esc(m.x)}</textarea>
     <input name=chi placeholder="Ditta o tecnico (facoltativo)" value="${esc(m.chi)}">
     <div id=rsw style="display:${m.ty == 'g' ? 'block' : 'none'}"><label class=chk><input type=checkbox name=rs ${m.rs ? 'checked' : ''}>Risolto</label></div>`,
    d => {
      const ty = d.querySelector('[data-ty].on').dataset.ty;
      if (!v(d, 'o').trim()) { alert('Scrivi l\'attrezzatura.'); return false; }
      if (ty == 'g' && !v(d, 'x').trim()) { alert('Descrivi il guasto.'); return false; }
      const wasOpen = m.ty == 'g' && !m.rs, rs = ty == 'g' && d.querySelector('[name=rs]').checked;
      Object.assign(m, {ty, o:v(d, 'o').trim(), d:v(d, 'd') || today(), x:v(d, 'x').trim(), chi:v(d, 'chi').trim(), sc:ty == 'g' ? '' : v(d, 'sc'), rs:rs ? (m.rs || today()) : ''});
      if (n) { S.mt.push(m); act('manutenzione', `${MTT[ty].l}: ${m.o}${m.x ? ' — ' + m.x.slice(0, 80) : ''}`); }
      else if (wasOpen && rs) act('manutenzione', `Guasto risolto: ${m.o}`);
    }, n ? '' : `<button type=button class="g d" id=mtx>Elimina</button>`);
  const D = $('#d'), show = ty => { $('#rsw').style.display = ty == 'g' ? 'block' : 'none'; $('#scw').style.visibility = ty == 'g' ? 'hidden' : 'visible'; $('#scq').style.display = ty == 'g' ? 'none' : 'block'; };
  D.querySelectorAll('[data-ty]').forEach(b => b.onclick = () => { D.querySelectorAll('[data-ty]').forEach(o => o.classList.toggle('on', o == b)); show(b.dataset.ty); });
  $('#scq').onclick = e => { const b = e.target.closest('[data-mm]'); if (b) D.querySelector('[name=sc]').value = addM(+b.dataset.mm); };
  show(m.ty);
  if (!n) $('#mtx').onclick = () => { if (confirm('Eliminare questa registrazione?')) { S.mt = S.mt.filter(x => x.id != m.id); save(); D.close(); } };
}

function vMt() {
  const O = mtOpen(), Du = mtDue(), H = [...S.mt].sort((a, b) => (b.d + b.id).localeCompare(a.d + a.id)).slice(0, 60);
  const row = m => `<div class=li data-a=mte data-id=${m.id} style="cursor:pointer"><div class=row><span><b>${esc(m.o)}</b> <span class=m>${MTT[m.ty].l}</span></span><span class=m>${dm(m.d)}</span></div>${m.x ? `<div class=m style="font-size:13px">${esc(m.x)}</div>` : ''}<div class=m style="font-size:12px">${[m.chi, m.by, m.ty == 'g' ? (m.rs ? 'risolto il ' + dm(m.rs) : 'aperto') : m.sc ? 'prossima ' + trR(m.sc) : ''].filter(Boolean).map(esc).join(' · ')}</div></div>`;
  return `<div class="row st np" style="margin-bottom:10px"><button data-a=mtn data-id=g>Segnala guasto</button><button class=g data-a=mtn data-id=t>+ Taratura</button><button class=g data-a=mtn data-id=p>+ Infestanti</button><button class=g data-a=mtn data-id=i>+ Intervento</button><button class="g np" data-a=print>Stampa</button></div>`
    + (O.length ? `<div class=card style="border-color:var(--r)"><b class=bad>Guasti aperti</b>${O.map(row).join('')}</div>` : '')
    + (Du.length ? `<div class=card><b>Prossime scadenze</b>${Du.map(m => { const k = days(m.sc); return `<div class=row style="margin-top:6px" data-a=mte data-id=${m.id}><span>${esc(m.o)} <span class=m>${MTT[m.ty].l}</span></span><span class="${k < 0 ? 'bad' : k <= MTW ? 'warn' : 'm'}">${k < 0 ? 'scaduto ' + trR(m.sc) : k == 0 ? 'oggi' : trR(m.sc)}</span></div>`; }).join('')}<div class=hint>Per rinnovare una scadenza registra il nuovo controllo con la prossima data.</div></div>` : '')
    + `<div class=card><b>Storico</b>${H.map(row).join('') || '<div class=m style="margin-top:6px">Nessuna registrazione. Segna qui guasti, interventi dei tecnici, tarature dei termometri e controlli degli infestanti: sono documenti che il controllo HACCP chiede spesso.</div>'}</div>`;
}

Object.assign(A, {mtn: id => eMt(null, id), mte: id => eMt(id)});
