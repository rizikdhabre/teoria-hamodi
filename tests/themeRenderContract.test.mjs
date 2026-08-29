import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const layoutPath = new URL('../app/layout.js', import.meta.url);

test('renders dark by default and only removes it for a stored light theme', async () => {
  const layout = await readFile(layoutPath, 'utf8');

  assert.match(
    layout,
    /<html\s+className="dark"\s+lang=\{htmlLang\}\s+dir=\{dir\}/,
  );
  assert.match(
    layout,
    /try\s*\{\s*var theme = localStorage\.getItem\('theme'\);\s*if \(theme === 'light'\) \{\s*document\.documentElement\.classList\.remove\('dark'\);\s*\} else \{\s*document\.documentElement\.classList\.add\('dark'\);\s*\}\s*\} catch \(e\) \{\}/,
  );
});
