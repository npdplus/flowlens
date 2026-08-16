import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { extname } from 'node:path';

const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);

const binaryExtensions = new Set([
  '.ico',
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.pdf',
  '.zip',
  '.gz',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
]);

const rules = [
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/gu],
  ['github-token', /\bgh(?:p|o|u|s|r)_[A-Za-z0-9]{30,}\b/gu],
  ['aws-access-key', /\bAKIA[0-9A-Z]{16}\b/gu],
  ['google-api-key', /\bAIza[0-9A-Za-z_-]{30,}\b/gu],
  ['slack-token', /\bxox[baprs]-[0-9A-Za-z-]{20,}\b/gu],
  ['openai-style-key', /\bsk-[A-Za-z0-9_-]{20,}\b/gu],
  ['stripe-secret-key', /\bsk_(?:live|test)_[0-9A-Za-z]{20,}\b/gu],
];

const findings = [];
let scannedFiles = 0;

for (const file of files) {
  if (binaryExtensions.has(extname(file).toLowerCase())) continue;
  if (statSync(file).size > 2_000_000) continue;

  const source = readFileSync(file, 'utf8');
  scannedFiles += 1;
  for (const [ruleName, pattern] of rules) {
    pattern.lastIndex = 0;
    if (pattern.test(source)) findings.push(`${file}: ${ruleName}`);
  }
}

if (findings.length > 0) {
  throw new Error(`Potential secret material detected:\n${findings.join('\n')}`);
}

console.log(
  `[P10_SECRET_SCAN] trackedFiles=${files.length} scannedTextFiles=${scannedFiles} findings=0`,
);
