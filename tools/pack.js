/* Packs the extension into a store-ready zip — no dependencies, just the
 * zip format written by hand (stored, no compression, which is valid).
 *   node tools/pack.js  ->  instaghost-<version>.zip
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');
const version = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8')).version;
const OUT = path.join(ROOT, `instaghost-${version}.zip`);

/* Only what the browser actually loads. */
const INCLUDE = [/^manifest\.json$/, /^icons\//, /^src\//, /^README\.md$/, /^LICENSE$/];

function walk(dir, base = '', out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.name === '.git' || e.name === 'node_modules') continue;
    if (e.isDirectory()) walk(path.join(dir, e.name), rel, out);
    else if (INCLUDE.some(r => r.test(rel))) out.push(rel);
  }
  return out;
}

const crcTable = (() => {
  const t = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

const files = walk(ROOT);
const chunks = [];
const central = [];
let offset = 0;

for (const rel of files) {
  const data = fs.readFileSync(path.join(ROOT, rel));
  const deflated = zlib.deflateRawSync(data, { level: 9 });
  const name = Buffer.from(rel, 'utf8');
  const crc = crc32(data);

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);            // version needed
  local.writeUInt16LE(0, 6);             // flags
  local.writeUInt16LE(8, 8);             // deflate
  local.writeUInt16LE(0, 10);            // time
  local.writeUInt16LE(0x21, 12);         // date (1980-01-01)
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(deflated.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(name.length, 26);
  local.writeUInt16LE(0, 28);

  chunks.push(local, name, deflated);

  const cd = Buffer.alloc(46);
  cd.writeUInt32LE(0x02014b50, 0);
  cd.writeUInt16LE(20, 4);
  cd.writeUInt16LE(20, 6);
  cd.writeUInt16LE(0, 8);
  cd.writeUInt16LE(8, 10);
  cd.writeUInt16LE(0, 12);
  cd.writeUInt16LE(0x21, 14);
  cd.writeUInt32LE(crc, 16);
  cd.writeUInt32LE(deflated.length, 20);
  cd.writeUInt32LE(data.length, 24);
  cd.writeUInt16LE(name.length, 28);
  cd.writeUInt32LE(offset, 42);
  central.push(cd, name);

  offset += local.length + name.length + deflated.length;
}

const cdBuf = Buffer.concat(central);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(cdBuf.length, 12);
end.writeUInt32LE(offset, 16);

fs.writeFileSync(OUT, Buffer.concat([...chunks, cdBuf, end]));
console.log(`packed ${files.length} files -> ${path.basename(OUT)} (${(fs.statSync(OUT).size / 1024).toFixed(1)} KB)`);
