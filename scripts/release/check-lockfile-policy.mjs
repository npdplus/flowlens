import { readFile } from 'node:fs/promises';

const EXPECTED_PACKAGE_ENTRIES = 213;
const lockfile = await readFile(new URL('../../pnpm-lock.yaml', import.meta.url), 'utf8');
const npmrc = await readFile(new URL('../../.npmrc', import.meta.url), 'utf8');

const packagesStart = lockfile.indexOf('\npackages:\n');
const snapshotsStart = lockfile.indexOf('\nsnapshots:\n');
if (packagesStart < 0 || snapshotsStart < 0 || snapshotsStart <= packagesStart) {
  throw new Error('Unable to locate pnpm lockfile package sections.');
}

const packageSection = lockfile.slice(packagesStart + '\npackages:\n'.length, snapshotsStart);
const packageEntries = packageSection.split(/\r?\n/u).filter((line) => /^  \S.*:\s*$/u.test(line));
const integrityEntries = packageSection
  .split(/\r?\n/u)
  .filter((line) => /^    resolution: .*integrity:/u.test(line));

if (packageEntries.length !== EXPECTED_PACKAGE_ENTRIES) {
  throw new Error(
    `Unexpected lockfile package count: ${packageEntries.length}; expected ${EXPECTED_PACKAGE_ENTRIES}.`,
  );
}
if (integrityEntries.length !== packageEntries.length) {
  throw new Error(
    `Lockfile integrity coverage mismatch: ${integrityEntries.length}/${packageEntries.length} package entries.`,
  );
}

const tarballUrls = [...lockfile.matchAll(/tarball:\s*([^\s,}]+)/gu)].map((match) => match[1]);
const disallowedTarballs = tarballUrls.filter(
  (url) => url !== undefined && !url.startsWith('https://registry.npmjs.org/'),
);
if (disallowedTarballs.length > 0) {
  throw new Error(`Unexpected lockfile tarball source(s): ${disallowedTarballs.join(', ')}`);
}

if (/^\s*(?:@[^:]+:)?registry\s*=/imu.test(npmrc)) {
  throw new Error('Repository .npmrc overrides the package registry.');
}

console.log(
  `[P10_LOCKFILE] packageEntries=${packageEntries.length} integrityEntries=${integrityEntries.length} externalTarballs=${disallowedTarballs.length} registryOverride=false`,
);
