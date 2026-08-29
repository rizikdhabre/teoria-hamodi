import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

const consumers = [
  ['components/layout/Header.js', ['ברוך הבא -חמודי תיאוריה', 'יציאה', 'אודות', 'בית', 'צור קשר', 'הרשמה/כניסה']],
  ['components/layout/Footer.js', ['תיאוריה חמודי · כל הזכויות שמורות']],
  ['components/Dashboard.js', ['🚗 רכב ואופנוע', 'למד תיאוריה בקלות, במהירות ובכיף 🚗', 'שחזור סיסמה (מנהל)']],
  ['app/about/page.js', ['בית ספר מקצועי ללימודי תיאוריה ונהיגה', 'סוגי רישיונות', 'יצירת קשר']],
  ['app/contactUs/page.js', ['יצירת קשר', 'נשמח לענות על כל שאלה וללוות אתכם בדרך להצלחה', 'ישראל']],
  ['app/(auth)/login/LoginClient.js', ['דף כניסה', 'סיסמה חודשית', 'ברוך הבא', 'אנא מלא את כל השדות']],
];

test('global translation consumers register their static Hebrew UI sources', () => {
  for (const [file, sources] of consumers) {
    const source = read(file);
    assert.match(source, /useTranslationStrings/,
      `${file} should use React-owned translation strings`);
    for (const hebrew of sources) {
      assert.match(source, new RegExp(`['\"]${hebrew.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['\"]`),
        `${file} should retain the exact Hebrew source ${hebrew}`);
    }
  }
});

test('header keeps language selector labels literal while translating visible UI labels', () => {
  const source = read('components/layout/Header.js');

  assert.match(source, /label: 'HE — עברית'/);
  assert.match(source, /label: 'AR — العربية'/);
  assert.match(source, /label: 'EN — English'/);
  assert.doesNotMatch(source, /data-no-translate/);
});

test('dashboard derives direction from language context and keeps cookie navigation', () => {
  const source = read('components/Dashboard.js');

  assert.match(source, /const \{ dir \} = useLanguage\(\);/);
  assert.match(source, /window\.location\.assign\(nextLink\)/);
  assert.doesNotMatch(source, /document\.documentElement\.dir/);
  assert.doesNotMatch(source, /console\.log\(err\.response\?\.data\?\.message\)/);
});

test('global translation consumers do not mutate rendered text through the DOM', () => {
  const source = consumers.map(([file]) => read(file)).join('\n');

  assert.doesNotMatch(source, /createTreeWalker|MutationObserver|nodeValue|textContent\s*=/);
});
