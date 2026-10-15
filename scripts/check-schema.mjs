import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const real = new Set(JSON.parse(fs.readFileSync(path.join(root, 'scripts/inscripciones-columns.json'), 'utf8')));
const ID = /^[A-Za-z_][A-Za-z0-9_]*$/;
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', '.backup', 'tmp', 'dist'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}
const errors = [];
for (const dir of ['api', 'src']) {
  for (const file of walk(path.join(root, dir))) {
    const txt = fs.readFileSync(file, 'utf8');
    for (const m of txt.matchAll(/\.from\(\s*['"]inscripciones['"]\s*\)/g)) {
      let seg = txt.slice(m.index + m[0].length, m.index + m[0].length + 1500);
      const end = seg.search(/;\s*\n/);
      seg = end >= 0 ? seg.slice(0, end) : seg.slice(0, 700);
      const line = txt.slice(0, m.index).split('\n').length;
      const cols = [];
      for (const s of seg.matchAll(/\.select\(\s*(['"`])([\s\S]*?)\1/g))
        if (s[2].trim() !== '*') cols.push(...s[2].split(/[,\s]+/));
      for (const f of seg.matchAll(/\.(?:eq|neq|in|ilike|like|order|gt|lt|is)\(\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"]/g)) cols.push(f[1]);
      const w = seg.match(/\.(?:update|insert|upsert)\(\s*\{([\s\S]*?)\}\s*\)/);
      if (w) for (const k of w[1].matchAll(/(?:^|[,{\n]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g)) cols.push(k[1]);
      for (const c of cols) if (c && ID.test(c) && !real.has(c)) errors.push(`${path.relative(root, file)}:${line}  columna inexistente en inscripciones: "${c}"`);
    }
  }
}
if (errors.length) { console.error('✖ check-schema:\n' + [...new Set(errors)].join('\n')); process.exit(1); }
console.log('✔ check-schema: todas las columnas usadas existen.');
