import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = async (relativePath) => JSON.parse(
  await readFile(path.join(root, relativePath), 'utf8')
);

test('manifest and package versions stay aligned', async () => {
  const [manifest, packageJson] = await Promise.all([
    readJson('manifest.json'),
    readJson('package.json')
  ]);
  assert.equal(manifest.version, packageJson.version);
  assert.equal(manifest.manifest_version, 3);
});

test('extension permissions remain intentionally narrow', async () => {
  const manifest = await readJson('manifest.json');
  assert.deepEqual(manifest.permissions, ['storage']);
  assert.deepEqual([...manifest.host_permissions].sort(), [
    'https://krdict.korean.go.kr/*',
    'https://translate.googleapis.com/*',
    'https://www.google-analytics.com/*'
  ]);
});

test('all locales expose the same message keys', async () => {
  const locales = await Promise.all(
    ['en', 'ko', 'vi'].map((locale) => readJson(`_locales/${locale}/messages.json`))
  );
  const expected = Object.keys(locales[0]).sort();
  for (const locale of locales.slice(1)) {
    assert.deepEqual(Object.keys(locale).sort(), expected);
  }
});

test('telemetry remains opt-in and has no built-in secret', async () => {
  const source = await readFile(path.join(root, 'background.js'), 'utf8');
  assert.match(source, /ga4TelemetryEnabled !== true/u);
  assert.doesNotMatch(source, /GA4_DEFAULT_API_SECRET/u);
});
