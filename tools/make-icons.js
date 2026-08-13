/* Generates the extension icons as raw PNGs — no image libraries needed.
 * Run: node tools/make-icons.js  (from the extension root) */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..', 'icons');
fs.mkdirSync(OUT, { recursive: true });

function crc32(buf) {
  let c, table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;      // bit depth
  ihdr[9] = 6;      // RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/* Rounded gradient tile with a ghost silhouette. */
function draw(size) {
  const px = Buffer.alloc(size * size * 4);
  const r = size * 0.24;                    // corner radius
  const set = (x, y, c, a) => {
    const i = (y * size + x) * 4;
    const na = a + px[i + 3] * (1 - a) / 255;
    px[i] = c[0] * a + px[i] * (1 - a);
    px[i + 1] = c[1] * a + px[i + 1] * (1 - a);
    px[i + 2] = c[2] * a + px[i + 2] * (1 - a);
    px[i + 3] = Math.min(255, na * 255 || px[i + 3]);
  };

  const inRounded = (x, y) => {
    const cx = Math.min(Math.max(x, r), size - r);
    const cy = Math.min(Math.max(y, r), size - r);
    const dx = x - cx, dy = y - cy;
    return dx * dx + dy * dy <= r * r + 0.01 || (x >= r && x <= size - r) || (y >= r && y <= size - r);
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!inRounded(x + .5, y + .5)) continue;
      const t = (x / size * 0.55 + y / size * 0.45);
      const col = [
        Math.round(140 - 26 * t),
        Math.round(104 - 34 * t),
        Math.round(255 - 26 * t)
      ];
      const i = (y * size + x) * 4;
      px[i] = col[0]; px[i + 1] = col[1]; px[i + 2] = col[2]; px[i + 3] = 255;
    }
  }

  /* ghost body: circle head + skirt with three scallops */
  const gx = size / 2;
  const gy = size * 0.44;
  const rad = size * 0.24;
  const bottom = size * 0.76;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x + .5 - gx, dy = y + .5 - gy;
      let inside = false;
      if (dy <= 0) inside = dx * dx + dy * dy <= rad * rad;
      else if (y < bottom) inside = Math.abs(dx) <= rad;
      else {
        const local = (x - (gx - rad)) / (rad * 2 / 3);
        const k = local - Math.floor(local);
        const wave = Math.sin(k * Math.PI) * size * 0.055;
        inside = Math.abs(dx) <= rad && (y - bottom) <= wave;
      }
      if (!inside) continue;
      const i = (y * size + x) * 4;
      px[i] = 255; px[i + 1] = 255; px[i + 2] = 255; px[i + 3] = 245;
    }
  }

  /* eyes */
  const er = Math.max(1, size * 0.045);
  [[gx - rad * 0.42, gy - rad * 0.05], [gx + rad * 0.42, gy - rad * 0.05]].forEach(([ex, ey]) => {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x + .5 - ex, dy = y + .5 - ey;
        if (dx * dx + dy * dy > er * er) continue;
        const i = (y * size + x) * 4;
        px[i] = 60; px[i + 1] = 42; px[i + 2] = 120; px[i + 3] = 255;
      }
    }
  });

  return px;
}

[16, 32, 48, 128].forEach(size => {
  const file = path.join(OUT, `icon${size}.png`);
  fs.writeFileSync(file, png(size, draw(size)));
  console.log('wrote', file);
});
