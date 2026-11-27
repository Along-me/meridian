// Rebuild the embedded IANA/CLDR catalogue using an apply_patch executable.
// Source downloads stay local. The delivered HTML needs no network or build step.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = __dirname;
const patchExe = process.argv[2];
if (!patchExe) throw new Error('Pass the native apply_patch executable path.');
if (fs.readFileSync(path.join(root, 'prototype.html'), 'utf8').includes('const zoneRegistry = [')) throw new Error('Catalogue already embedded. Remove the generated registry before regenerating it.');
const cldr = JSON.parse(fs.readFileSync(path.join(root, 'cldr-timezones-zh.json'), 'utf8')).main.zh.dates.timeZoneNames.zone;
function lookup(id) { return id.split('/').reduce((value, part) => value && value[part], cldr); }
const registry = fs.readFileSync(path.join(root, 'zone-source.tab'), 'utf8').split(/\r?\n/)
  .filter(line => line && !line.startsWith('#')).map(line => {
    const [country, , id] = line.split('\t');
    let canonical = id;
    try { canonical = new Intl.DateTimeFormat('en', { timeZone: id }).resolvedOptions().timeZone; } catch (_) {}
    const translated = lookup(id) || lookup(canonical);
    return [id, country, translated && translated.exemplarCity || id.split('/').pop().replace(/_/g, ' ')];
  });
const lines = [
  '// IANA tzdb zone.tab + Unicode CLDR zh, downloaded 2026-11-11.',
  '// https://github.com/eggert/tz/blob/main/zone.tab (public domain)',
  '// https://github.com/unicode-org/cldr-json (Unicode License V3)',
  'const zoneRegistry = [', ...registry.map(row => JSON.stringify(row) + ','), '];',
  "const regionNames = new Intl.DisplayNames(['zh-CN'], { type: 'region' });",
  'for (const [id, code, city] of zoneRegistry) {',
  '  if (catalogue.some(z => z.id === id)) continue;',
  "  try { new Intl.DateTimeFormat('en', { timeZone: id }); } catch (_) { continue; }",
  "  catalogue.push({ id, code, city, country: regionNames.of(code), en: id.split('/').pop().replace(/_/g, ' ') });",
  '}'
];
// Small batches also work within Windows native command-line limits.
for (let i = 0; i < lines.length; i += 45) {
  const patch = '*** Begin Patch\n*** Update File: MeridianWidget/prototype.html\n@@\n-// TIMEZONE_REGISTRY\n'
    + lines.slice(i, i + 45).map(line => '+' + line).join('\n') + '\n+// TIMEZONE_REGISTRY\n*** End Patch';
  const r = spawnSync(patchExe, ['--codex-run-as-apply-patch', patch], { cwd: path.dirname(root), encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout || r.error);
}
console.log('Embedded ' + registry.length + ' IANA regions with CLDR city names.');
