import { spawnSync } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];

async function readJson(relativePath) {
  try {
    return JSON.parse(await readFile(path.join(root, relativePath), 'utf8'));
  } catch (error) {
    failures.push(`${relativePath}: ${error.message}`);
    return null;
  }
}

async function requireFile(relativePath) {
  try {
    const info = await stat(path.join(root, relativePath));
    if (!info.isFile()) failures.push(`${relativePath}: not a file`);
  } catch {
    failures.push(`${relativePath}: missing`);
  }
}

const manifest = await readJson('manifest.json');
const packageJson = await readJson('package.json');
const localeNames = ['en', 'ko', 'vi'];
const locales = {};

for (const locale of localeNames) {
  locales[locale] = await readJson(`_locales/${locale}/messages.json`);
}

if (manifest && packageJson && manifest.version !== packageJson.version) {
  failures.push(`manifest version ${manifest.version} does not match package version ${packageJson.version}`);
}
if (manifest?.manifest_version !== 3) failures.push('manifest_version must be 3');
if (manifest?.default_locale !== 'en') failures.push('default_locale must be en');

const requiredFiles = new Set([
  'LICENSE',
  'NOTICE',
  'README.md',
  'CONTRIBUTING.md',
  'SECURITY.md',
  manifest?.background?.service_worker,
  manifest?.action?.default_popup,
  ...(manifest?.content_scripts ?? []).flatMap((entry) => [...(entry.js ?? []), ...(entry.css ?? [])]),
  ...Object.values(manifest?.icons ?? {}),
  ...Object.values(manifest?.action?.default_icon ?? {})
].filter(Boolean));

for (const relativePath of requiredFiles) await requireFile(relativePath);

const jsFiles = [
  'background.js',
  'content.js',
  'popup.js',
  'welcome.js',
  'scripts/set_ga4_telemetry.js'
];

for (const relativePath of jsFiles) {
  const result = spawnSync(process.execPath, ['--check', path.join(root, relativePath)], {
    encoding: 'utf8'
  });
  if (result.status !== 0) {
    failures.push(`${relativePath}: ${result.stderr.trim() || 'syntax check failed'}`);
  }
}

const baseKeys = Object.keys(locales.en ?? {}).sort();
for (const locale of localeNames.slice(1)) {
  const keys = Object.keys(locales[locale] ?? {}).sort();
  const missing = baseKeys.filter((key) => !keys.includes(key));
  const extra = keys.filter((key) => !baseKeys.includes(key));
  if (missing.length) failures.push(`${locale} locale missing keys: ${missing.join(', ')}`);
  if (extra.length) failures.push(`${locale} locale has extra keys: ${extra.join(', ')}`);
}

for (const [locale, messages] of Object.entries(locales)) {
  for (const [key, value] of Object.entries(messages ?? {})) {
    if (typeof value?.message !== 'string' || value.message.trim() === '') {
      failures.push(`${locale}.${key}: message must be a non-empty string`);
    }
  }
}

const trackedSource = await Promise.all([
  readFile(path.join(root, 'background.js'), 'utf8'),
  readFile(path.join(root, 'scripts/set_ga4_telemetry.js'), 'utf8')
]);
if (trackedSource.some((source) => source.includes('GA4_DEFAULT_API_SECRET'))) {
  failures.push('GA4 credentials must not have a built-in default');
}
const telemetryHelper = trackedSource[1];
const configuredSecret = telemetryHelper.match(/ga4ApiSecret:\s*['"]([^'"]+)['"]/u)?.[1];
if (configuredSecret && configuredSecret !== 'YOUR_SECRET') {
  failures.push('scripts/set_ga4_telemetry.js must contain a placeholder, not a real secret');
}

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}

console.log(`Validated Manifest V3 package ${manifest.version}, ${requiredFiles.size} required files, ${localeNames.length} locales, and ${jsFiles.length} JavaScript files.`);
