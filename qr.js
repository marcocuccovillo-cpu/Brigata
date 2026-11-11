// Brigata — generatore di codici QR (byte mode, correzione M, versioni 1-10). Nessuna libreria esterna.
'use strict';

function qrMatrix(text) {
  const VER = [null, [26,1,10], [44,1,16], [70,1,26], [100,2,18], [134,2,24], [172,4,16], [196,4,18], [242,4,22], [292,5,22], [346,5,26]];
  const ALN = [null, [], [6,18], [6,22], [6,26], [6,30], [6,34], [6,22,38], [6,24,42], [6,26,46], [6,28,50]];
  const data = [...new TextEncoder().encode(text)];
  let v = 1;
  for (; v <= 10; v++) {
    const [tot, nb, ec] = VER[v], cap = tot - nb * ec;
    if (4 + (v < 10 ? 8 : 16) + data.length * 8 <= cap * 8) break;
  }
  if (v > 10) throw new Error('Testo troppo lungo per il QR');
  const [tot, nb, ec] = VER[v], cap = tot - nb * ec, size = v * 4 + 17;

  // flusso di bit
  const bits = [];
  const put = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  put(4, 4); put(data.length, v < 10 ? 8 : 16); data.forEach(b => put(b, 8));
  put(0, Math.min(4, cap * 8 - bits.length));
  put(0, (8 - bits.length % 8) % 8);
  for (let p = 0xEC; bits.length < cap * 8; p ^= 0xEC ^ 0x11) put(p, 8);
  const cw = [];
  for (let i = 0; i < bits.length; i += 8) cw.push(bits.slice(i, i + 8).reduce((a, b) => a << 1 | b, 0));

  // Reed-Solomon
  const mul = (x, y) => { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z & 255; };
  const div = []; for (let i = 0; i < ec - 1; i++) div.push(0); div.push(1);
  for (let i = 0, root = 1; i < ec; i++) { for (let j = 0; j < ec; j++) { div[j] = mul(div[j], root); if (j + 1 < ec) div[j] ^= div[j + 1]; } root = mul(root, 2); }
  const rem = d => { const r = div.map(() => 0); d.forEach(b => { const f = b ^ r.shift(); r.push(0); div.forEach((c, i) => r[i] ^= mul(c, f)); }); return r; };
  const nShort = nb - tot % nb, shortLen = Math.floor(tot / nb), blocks = [];
  for (let i = 0, k = 0; i < nb; i++) {
    const dl = shortLen - ec + (i < nShort ? 0 : 1), d = cw.slice(k, k + dl); k += dl;
    const e = rem(d);
    if (i < nShort) d.push(0);
    blocks.push(d.concat(e));
  }
  const out = [];
  for (let i = 0; i < blocks[0].length; i++) blocks.forEach((b, j) => { if (i != shortLen - ec || j >= nShort) out.push(b[i]); });

  // matrice e moduli fissi
  const M = Array.from({length: size}, () => Array(size).fill(false));
  const F = Array.from({length: size}, () => Array(size).fill(false));
  const set = (x, y, d) => { M[y][x] = d; F[y][x] = true; };
  for (let i = 0; i < size; i++) { set(6, i, i % 2 == 0); set(i, 6, i % 2 == 0); }
  [[3,3],[size - 4,3],[3,size - 4]].forEach(([cx, cy]) => {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx, y = cy + dy, d = Math.max(Math.abs(dx), Math.abs(dy));
      if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, d != 2 && d != 4);
    }
  });
  const al = ALN[v], L = al.length;
  for (let i = 0; i < L; i++) for (let j = 0; j < L; j++) {
    if ((i == 0 && j == 0) || (i == 0 && j == L - 1) || (i == L - 1 && j == 0)) continue;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(al[i] + dx, al[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) != 1);
  }
  const fmt = mask => {
    const d = mask;   // livello M = 00
    let r = d; for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
    const b = ((d << 10) | r) ^ 0x5412, g = i => ((b >>> i) & 1) == 1;
    for (let i = 0; i <= 5; i++) set(8, i, g(i));
    set(8, 7, g(6)); set(8, 8, g(7)); set(7, 8, g(8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, g(i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, g(i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, g(i));
    set(8, size - 8, true);
  };
  fmt(0);
  if (v >= 7) {
    let r = v; for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1F25);
    const b = v << 12 | r;
    for (let i = 0; i < 18; i++) { const d = ((b >>> i) & 1) == 1, a = size - 11 + i % 3, c = Math.floor(i / 3); set(a, c, d); set(c, a, d); }
  }

  // dati a zig-zag
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right == 6) right = 5;
    for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
      const x = right - j, up = ((right + 1) & 2) == 0, y = up ? size - 1 - vert : vert;
      if (!F[y][x] && i < out.length * 8) { M[y][x] = ((out[i >>> 3] >>> (7 - (i & 7))) & 1) == 1; i++; }
    }
  }

  // maschera con penalità minore
  const MF = [(x, y) => (x + y) % 2 == 0, (x, y) => y % 2 == 0, x => x % 3 == 0, (x, y) => (x + y) % 3 == 0, (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 == 0, (x, y) => x * y % 2 + x * y % 3 == 0, (x, y) => (x * y % 2 + x * y % 3) % 2 == 0, (x, y) => ((x + y) % 2 + x * y % 3) % 2 == 0];
  const apply = k => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!F[y][x] && MF[k](x, y)) M[y][x] = !M[y][x]; };
  const pen = () => {
    let p = 0, dark = 0;
    const line = get => {
      let run = 1, s = '';
      for (let k = 0; k < size; k++) {
        const c = get(k); s += c ? '1' : '0';
        if (k > 0) { if (c == get(k - 1)) { run++; if (run == 5) p += 3; else if (run > 5) p++; } else run = 1; }
      }
      for (const pat of ['10111010000', '00001011101']) { let at = s.indexOf(pat); while (at >= 0) { p += 40; at = s.indexOf(pat, at + 1); } }
    };
    for (let y = 0; y < size; y++) line(x => M[y][x]);
    for (let x = 0; x < size; x++) line(y => M[y][x]);
    for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) { const c = M[y][x]; if (c == M[y][x + 1] && c == M[y + 1][x] && c == M[y + 1][x + 1]) p += 3; }
    M.forEach(r => r.forEach(c => { if (c) dark++; }));
    return p + Math.floor(Math.abs(dark * 100 / (size * size) - 50) / 5) * 10;
  };
  let best = 0, bp = Infinity;
  for (let k = 0; k < 8; k++) { apply(k); fmt(k); const p = pen(); if (p < bp) { bp = p; best = k; } apply(k); }
  apply(best); fmt(best);
  return M;
}

function drawQR(c, text) {
  try {
    const m = qrMatrix(text), n = m.length, q = 4, sc = Math.max(4, Math.floor(264 / (n + q * 2)));
    c.width = c.height = (n + q * 2) * sc;
    const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#14120e';
    m.forEach((r, y) => r.forEach((b, x) => { if (b) g.fillRect((x + q) * sc, (y + q) * sc, sc, sc); }));
  } catch (e) { console.warn(e); }
}
