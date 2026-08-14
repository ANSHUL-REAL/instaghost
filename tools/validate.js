/* InstaGhost — repo validator. No dependencies; this is what CI runs.
 *   node tools/validate.js
 *
 * Checks:
 *   1. every .js file parses
 *   2. every path referenced by manifest.json exists
 *   3. every schema key has a label, a hint and a default
 *   4. every world:'page' schema key has a matching rule in hook.js
 */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = path.join(__dirname, '..');
let failures = 0;

function fail(msg) { console.error('  ✗ ' + msg); failures++; }
function ok(msg) { console.log('  ✓ ' + msg); }
function section(t) { console.log('\n' + t); }

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '.git' || e.name === 'node_modules') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

/* ---- 1. syntax ---- */
section('Syntax');
const jsFiles = walk(ROOT).filter(f => f.endsWith('.js'));
for (const f of jsFiles) {
  try {
    cp.execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
  } catch (e) {
    fail(path.relative(ROOT, f) + '\n' + String(e.stderr || e.message).trim());
  }
}
if (!failures) ok(jsFiles.length + ' JavaScript files parse');

/* ---- 2. manifest ---- */
section('Manifest');
let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
  ok('manifest.json is valid JSON');
} catch (e) {
  fail('manifest.json does not parse: ' + e.message);
}

if (manifest) {
  const refs = [
    ...manifest.content_scripts.flatMap(c => [...(c.js || []), ...(c.css || [])]),
    manifest.background.service_worker,
    manifest.action.default_popup,
    ...Object.values(manifest.icons || {}),
    ...Object.values(manifest.action.default_icon || {})
  ];
  const missing = [...new Set(refs)].filter(r => !fs.existsSync(path.join(ROOT, r)));
  if (missing.length) missing.forEach(m => fail('manifest references a missing file: ' + m));
  else ok([...new Set(refs)].length + ' referenced paths all resolve');

  if (manifest.manifest_version !== 3) fail('manifest_version must be 3');
}

/* ---- 3. schema ---- */
section('Feature schema');
const sandbox = { chrome: { storage: { local: {}, onChanged: { addListener() {} } } } };
const cfgSrc = fs.readFileSync(path.join(ROOT, 'src/shared/config.js'), 'utf8');
new Function('self', cfgSrc)(sandbox);
const CFG = sandbox.IGX_CONFIG;

if (!CFG) {
  fail('config.js did not export IGX_CONFIG');
} else {
  const seen = new Set();
  const groups = new Set(CFG.GROUPS.map(g => g.id).concat('master'));
  for (const d of CFG.SCHEMA) {
    if (seen.has(d.key)) fail('duplicate schema key: ' + d.key);
    seen.add(d.key);
    if (!d.label) fail(d.key + ' has no label');
    if (!d.hint) fail(d.key + ' has no hint');
    if (d.def === undefined) fail(d.key + ' has no default');
    if (!groups.has(d.group)) fail(d.key + ' is in unknown group "' + d.group + '"');
    if (d.type === 'select' && !(d.options || []).length) fail(d.key + ' is a select with no options');
  }
  if (!failures) ok(CFG.SCHEMA.length + ' settings across ' + CFG.GROUPS.length + ' groups');
}

/* ---- 4. page rules ---- */
section('Ghost rules');
if (CFG) {
  const hook = fs.readFileSync(path.join(ROOT, 'src/inject/hook.js'), 'utf8');
  const ruleIds = [...hook.matchAll(/id:\s*'([A-Za-z0-9_]+)'/g)].map(m => m[1]);
  const pageKeys = CFG.PAGE_KEYS.filter(k => k !== 'enabled');
  const orphanKeys = pageKeys.filter(k => !ruleIds.includes(k));
  const orphanRules = ruleIds.filter(r => !CFG.PAGE_KEYS.includes(r));

  orphanKeys.forEach(k => fail("schema key '" + k + "' is world:'page' but hook.js has no rule with that id"));
  orphanRules.forEach(r => fail("hook.js rule '" + r + "' has no matching world:'page' schema key"));
  if (!orphanKeys.length && !orphanRules.length) ok(ruleIds.length + ' network rules match their schema keys');

  /* world:'extra' keys are forwarded to the hook but gate harvesting, not a
   * block rule — they must be read there and must NOT have a rule. */
  for (const k of CFG.EXTRA_PAGE_KEYS) {
    if (ruleIds.includes(k)) fail("'" + k + "' is world:'extra' but has a block rule — use world:'page'");
    else if (!hook.includes('settings.' + k)) fail("hook.js never reads settings." + k);
  }
  if (CFG.EXTRA_PAGE_KEYS.length) ok(CFG.EXTRA_PAGE_KEYS.length + " world:'extra' key(s) read by the hook");
}

/* ---- done ---- */
console.log('');
if (failures) {
  console.error(failures + ' problem' + (failures === 1 ? '' : 's') + ' found.');
  process.exit(1);
}
console.log('All checks passed.');
