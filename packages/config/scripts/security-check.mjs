import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const ignored = new Set(['node_modules', '.next', 'dist', '.git']);
const forbidden = [
  { expression: /TOSS_SANDBOX_SECRET_KEY\s*=\s*[^\s]/, label: 'committed Toss secret' },
  { expression: /\b(?:cardNumber|cvc|cvv|trackData)\b/i, label: 'possible card-data field' },
];

async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return ignored.has(entry.name) ? [] : files(path);
    return /\.(?:ts|tsx|js|mjs|json|ya?ml)$/.test(entry.name) ? [path] : [];
  }));
  return nested.flat();
}

const findings = [];
for (const file of await files(process.cwd())) {
  if (file.endsWith('.env.example') || file.endsWith('packages/config/scripts/security-check.mjs')) continue;
  const source = await readFile(file, 'utf8');
  for (const rule of forbidden) if (rule.expression.test(source)) findings.push(`${rule.label}: ${file}`);
}

if (findings.length) throw new Error(findings.join('\n'));
console.log('Security baseline check passed.');
