import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const header = readFileSync(new URL('../components/layout/Header.js', import.meta.url), 'utf8');
const bases = ['https://theory-hamodi.com/', 'https://theory-hamodi.com/courses/car'];

function contactHrefs(source) {
  return [...source.matchAll(/<Link\b[\s\S]*?<\/Link>/g)]
    .filter((link) => link[0].includes("t('צור קשר')"))
    .map((link) => {
      const href = link[0].match(/\bhref="([^"]+)"/);
      assert.ok(href, 'contact Link must have a literal href');
      return href[1];
    });
}

function resolvedContacts(source) {
  return bases.flatMap((base) => contactHrefs(source).map((href) => new URL(href, base).href));
}

test('desktop and mobile contact links resolve to the same root-relative contact page from root and nested routes', () => {
  assert.deepEqual(contactHrefs(header), ['/contactUs', '/contactUs']);
  assert.deepEqual(resolvedContacts(header), [
    'https://theory-hamodi.com/contactUs', 'https://theory-hamodi.com/contactUs',
    'https://theory-hamodi.com/contactUs', 'https://theory-hamodi.com/contactUs',
  ]);
});

test('a nested-relative contact-link mutation cannot satisfy the root-relative routing contract', () => {
  const nestedRelative = header.replaceAll('href="/contactUs"', 'href="contactUs"');

  assert.throws(() => assert.deepEqual(resolvedContacts(nestedRelative), [
    'https://theory-hamodi.com/contactUs', 'https://theory-hamodi.com/contactUs',
    'https://theory-hamodi.com/contactUs', 'https://theory-hamodi.com/contactUs',
  ]), assert.AssertionError);
});
