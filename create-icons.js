// Generates icon-180.png, icon-192.png, icon-512.png using only Node.js built-ins
const zlib = require('zlib');
const fs   = require('fs');

function writePNG(filename, size, getPixel) {
  function crc32(buf) {
    const t = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    let crc = 0xffffffff;
    for (const b of buf) crc = t[(crc ^ b) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function chunk(type, data) {
    const tb = Buffer.from(type, 'ascii');
    const lb = Buffer.allocUnsafe(4); lb.writeUInt32BE(data.length, 0);
    const cb = Buffer.allocUnsafe(4); cb.writeUInt32BE(crc32(Buffer.concat([tb, data])), 0);
    return Buffer.concat([lb, tb, data, cb]);
  }

  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8]=8; ihdr[9]=6; ihdr[10]=0; ihdr[11]=0; ihdr[12]=0; // RGBA

  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.allocUnsafe(1 + size * 4);
    row[0] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = getPixel(x, y);
      const o = 1 + x * 4;
      row[o]=r; row[o+1]=g; row[o+2]=b; row[o+3]=a;
    }
    rows.push(row);
  }

  const idat = zlib.deflateSync(Buffer.concat(rows), { level: 6 });
  const sig  = Buffer.from([137,80,78,71,13,10,26,10]);
  fs.writeFileSync(filename, Buffer.concat([sig, chunk('IHDR',ihdr), chunk('IDAT',idat), chunk('IEND',Buffer.alloc(0))]));
  console.log('Created', filename);
}

function makeReversiPixelFn(size) {
  const bg    = [26,  38,  52 ];  // #1a2634
  const green = [46,  125, 50 ];  // #2e7d32
  const dark  = [27,  94,  32 ];  // #1b5e20
  const black = [17,  17,  17 ];  // #111111
  const white = [238, 238, 238];  // #eeeeee

  const pad = size * 0.10;
  const bs  = size - pad * 2;
  const mid = size / 2;
  const q   = bs / 4;
  const r   = q * 0.75;
  const bgR = size * 0.20;
  const bR  = size * 0.05;
  const lw  = size * 0.015;

  function dist(x1,y1,x2,y2) { return Math.sqrt((x1-x2)**2+(y1-y2)**2); }

  function inRR(px, py, x, y, w, h, rad) {
    if (px < x || px > x+w || py < y || py > y+h) return false;
    const nearCornerX = px < x + rad || px > x + w - rad;
    const nearCornerY = py < y + rad || py > y + h - rad;
    if (!(nearCornerX && nearCornerY)) return true;
    const cx = px < x + rad ? x + rad : x + w - rad;
    const cy = py < y + rad ? y + rad : y + h - rad;
    return dist(px, py, cx, cy) <= rad;
  }

  // Anti-aliased edge: returns 0-255 alpha for a circle boundary
  function circleAlpha(px, py, cx, cy, rad) {
    const d = dist(px, py, cx, cy);
    if (d >= rad + 1) return 0;
    if (d <= rad - 1) return 255;
    return Math.round((rad + 1 - d) * 127.5);
  }

  function rrAlpha(px, py, x, y, w, h, rad) {
    if (px < x-1 || px > x+w+1 || py < y-1 || py > y+h+1) return 0;
    const nearCornerX = px < x + rad || px > x + w - rad;
    const nearCornerY = py < y + rad || py > y + h - rad;
    if (!(nearCornerX && nearCornerY)) {
      // Edge smoothing for straight sides
      const margin = Math.min(px - x, x+w - px, py - y, y+h - py);
      return margin >= 1 ? 255 : Math.round((margin + 1) * 127.5);
    }
    const cx = px < x + rad ? x + rad : x + w - rad;
    const cy = py < y + rad ? y + rad : y + h - rad;
    return circleAlpha(px, py, cx, cy, rad);
  }

  const stones = [
    [mid - q, mid - q, black],
    [mid + q, mid - q, white],
    [mid - q, mid + q, white],
    [mid + q, mid + q, black],
  ];

  return function getPixel(x, y) {
    const bgA = rrAlpha(x, y, 0, 0, size, size, bgR);
    if (bgA === 0) return [0, 0, 0, 0];

    // Stones (highest priority)
    for (const [cx, cy, col] of stones) {
      const a = circleAlpha(x, y, cx, cy, r);
      if (a > 0) return [...col, Math.round(a * bgA / 255)];
    }

    // Grid lines
    if (inRR(x, y, pad, pad, bs, bs, bR)) {
      if (Math.abs(x - mid) < lw / 2 || Math.abs(y - mid) < lw / 2)
        return [...dark, bgA];
      return [...green, bgA];
    }

    return [...bg, bgA];
  };
}

writePNG('icon-180.png', 180, makeReversiPixelFn(180));
writePNG('icon-192.png', 192, makeReversiPixelFn(192));
writePNG('icon-512.png', 512, makeReversiPixelFn(512));
