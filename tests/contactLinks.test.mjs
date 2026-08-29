import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const header = readFileSync(new URL('../components/layout/Header.js', import.meta.url), 'utf8');

test('desktop and mobile header contact links are root-relative', () => {
  const contactLinks = [...header.matchAll(/<Link href="(\/contactUs)"/g)];

  assert.equal(contactLinks.length, 2);
  assert.deepEqual(contactLinks.map((match) => match[1]), ['/contactUs', '/contactUs']);
});
