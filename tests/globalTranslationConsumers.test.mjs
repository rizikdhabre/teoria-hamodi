import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

function balancedContents(source, start, open, close) {
  let depth = 0;
  let quote = null;
  let escaped = false;

  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (!escaped && char === quote) quote = null;
      escaped = !escaped && char === '\\';
      continue;
    }
    if (char === '\'' || char === '"' || char === '`') {
      quote = char;
      continue;
    }
    if (char === open) depth += 1;
    if (char === close && --depth === 0) return source.slice(start + 1, index);
  }
  throw new Error(`Unclosed ${open} in source`);
}

function extractStringArray(source, constant) {
  const marker = `const ${constant} = [`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${constant} must be a top-level source list`);
  const contents = balancedContents(source, start + marker.length - 1, '[', ']');
  return [...contents.matchAll(/'((?:\\.|[^'])*)'/g)].map((match) => match[1]);
}

function translationInput(source) {
  const marker = 'useTranslationStrings(';
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, 'consumer must call useTranslationStrings');
  return balancedContents(source, start + marker.length - 1, '(', ')');
}

function assertRegisteredSourceList(source, constant, expected) {
  assert.deepEqual(extractStringArray(source, constant), expected,
    `${constant} must contain the complete, exact visible Hebrew source list`);
  assert.match(translationInput(source), new RegExp(`\\b${constant}\\b`),
    `${constant} must be registered through useTranslationStrings`);
}

function assertDirectTRenders(source, sources) {
  for (const text of sources) {
    const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(source, new RegExp(`t\\('${escaped}'\\)`),
      `visible source ${text} must render through t`);
  }
}

function assertDirectTRenderCounts(source, expected) {
  for (const [text, count] of Object.entries(expected)) {
    const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const renders = source.match(new RegExp(`t\\('${escaped}'\\)`, 'g')) ?? [];
    assert.equal(renders.length, count,
      `visible source ${text} must render through t in each declared UI location`);
  }
}

function assertTRendersExpressions(source, expressions) {
  for (const expression of expressions) {
    const escaped = expression.replace('.', '\\.');
    assert.match(source, new RegExp(`t\\(${escaped}\\)`),
      `${expression} must render through t`);
  }
}

const HEADER_SOURCES = [
  'ברוך הבא -חמודי תיאוריה', 'יציאה', 'אודות', 'בית', 'צור קשר', 'הרשמה/כניסה',
];
const FOOTER_SOURCES = ['תיאוריה חמודי · כל הזכויות שמורות'];
const DASHBOARD_SOURCES = [
  'יש להזין  PIN', 'שגיאת שרת, נסה שוב', 'שגיאה בשרת, נסה שוב מאוחר יותר',
  '🚗 רכב ואופנוע', ' אופנוע A', 'רכב פרטי B', '🚚 משאית', 'משאית C1', 'משאית C',
  '🚌 אוטובוס ו 🚜 טרקטור', 'אוטובוס D', 'טרקטור 1', '🌊 רישיונות ים', 'אופנוע ים', ' סירת מנוע ',
  'שיעורים פשוטים וברורים', 'זמינות 24/7 בכל מכשיר', 'תרגולים עד שתעברו בהצלחה', 'מותאם אישית לכל סוג רישיון',
  'למד תיאוריה בקלות, במהירות ובכיף 🚗', 'בחר את סוג הרישיון שלך ותתחיל להתקדם — צעד אחר צעד להצלחה!',
  'למה ללמוד אצלנו?', 'בחר את הקורס שלך', 'התחל עכשיו', 'תיאוריה חמודי', 'הזן סיסמה לקורס',
  'סיסמה', 'אישור', 'ביטול', 'שחזר', 'שחזור סיסמה (מנהל)', 'מאמת…', 'הסיסמה:',
];
const ABOUT_SOURCES = [
  'רכב פרטי (B)', 'רכב ציבורי (D)', 'אופנוע (A)', 'משאיות (C / C1)', 'טרקטור (1)', 'אופנוע ים',
  'שנות ניסיון מקצועי', 'תלמידים שסיימו בהצלחה', 'אחוזי הצלחה במבחנים', 'ליווי ותמיכה',
  'תיאוריה חמודי', 'בית ספר מקצועי ללימודי תיאוריה ונהיגה',
  'אנו מתמחים בהכנה מקיפה למבחני התיאוריה והנהיגה, תוך ליווי אישי,', 'שיטות לימוד מתקדמות וניסיון מוכח בהובלת תלמידים להצלחה.',
  'מי אנחנו?', 'תיאוריה חמודי הוא מוסד לימוד מוביל בתחום התיאוריה והנהיגה בישראל,',
  'עם התמחות בהכנה לכל סוגי הרישיונות — מהפרטי ועד המקצועי.', 'אנו מאמינים בשילוב בין מקצועיות, יחס אישי ולמידה חכמה, המאפשרים',
  'לכל תלמיד להגיע מוכן, בטוח וממוקד למבחן.', 'תלמידים שעברו בהצלחה', 'הצלחה שמדברת בעד עצמה',
  'איכות ללא פשרות', 'חומרי לימוד מעודכנים ותרגול ממוקד', 'צוות מנוסה', 'מורים מקצועיים עם ניסיון רב',
  'גמישות מלאה', 'זמני לימוד נוחים בהתאמה אישית', 'סוגי רישיונות', 'יצירת קשר', 'ישראל', 'ראשון–שישי | 08:00–20:00',
];
const CONTACT_SOURCES = ['יצירת קשר', 'נשמח לענות על כל שאלה וללוות אתכם בדרך להצלחה', 'ישראל', 'ראשון–שישי | 08:00–20:00'];
const LOGIN_SOURCES = ['אנא מלא את כל השדות', 'דף כניסה', 'שם משתמש', 'סיסמה', 'כניסה', 'סיסמה חודשית', 'קוד PIN', 'קבלת סיסמה', 'הסיסמה החדשה שלך:', 'ברוך הבא', 'אנו שמחים לראות אותכם שוב'];

test('Header and Footer register every visible static source and render it through t', () => {
  const header = read('components/layout/Header.js');
  const footer = read('components/layout/Footer.js');

  assertRegisteredSourceList(header, 'HEADER_HEBREW_SOURCES', HEADER_SOURCES);
  assertDirectTRenders(header, HEADER_SOURCES);
  assertDirectTRenderCounts(header, {
    'ברוך הבא -חמודי תיאוריה': 1,
    'יציאה': 1,
    'אודות': 2,
    'בית': 2,
    'צור קשר': 2,
    'הרשמה/כניסה': 2,
  });
  assertRegisteredSourceList(footer, 'FOOTER_HEBREW_SOURCES', FOOTER_SOURCES);
  assertDirectTRenders(footer, FOOTER_SOURCES);
});

test('Header leaves selector labels literal while translating only visible navigation UI', () => {
  const source = read('components/layout/Header.js');
  const registered = extractStringArray(source, 'HEADER_HEBREW_SOURCES');

  for (const label of ['HE — עברית', 'AR — العربية', 'EN — English']) {
    assert.match(source, new RegExp(`label: '${label}'`));
    assert.equal(registered.includes(label), false, `${label} must not be registered for translation`);
  }
  assert.doesNotMatch(source, /data-no-translate|translate="no"/);
});

test('Dashboard registers every static source, translates all render paths, and keeps navigation direction behavior', () => {
  const source = read('components/Dashboard.js');

  assertRegisteredSourceList(source, 'DASHBOARD_HEBREW_SOURCES', DASHBOARD_SOURCES);
  assertTRendersExpressions(source, ['c.name', 'adv.text', 'group.title', 'course.name', 'error', 'recoveryError']);
  assertDirectTRenders(source, [
    'למד תיאוריה בקלות, במהירות ובכיף 🚗', 'בחר את סוג הרישיון שלך ותתחיל להתקדם — צעד אחר צעד להצלחה!',
    'למה ללמוד אצלנו?', 'בחר את הקורס שלך', 'התחל עכשיו', 'תיאוריה חמודי', 'הזן סיסמה לקורס',
    'סיסמה', 'אישור', 'ביטול', 'שחזר', 'שחזור סיסמה (מנהל)', 'מאמת…', 'הסיסמה:',
  ]);
  assert.match(source, /const \{ dir \} = useLanguage\(\);/);
  assert.match(source, /window\.location\.assign\(nextLink\)/);
  assert.doesNotMatch(source, /document\.documentElement\.dir|console\.log\(err\.response\?\.data\?\.message\)/);
});

test('About and Contact register every static source and render static labels through t', () => {
  const about = read('app/about/page.js');
  const contact = read('app/contactUs/page.js');

  assertRegisteredSourceList(about, 'ABOUT_HEBREW_SOURCES', ABOUT_SOURCES);
  assertTRendersExpressions(about, ['item.label', 'stat.label']);
  assertDirectTRenders(about, ABOUT_SOURCES.slice(10));
  assertRegisteredSourceList(contact, 'CONTACT_HEBREW_SOURCES', CONTACT_SOURCES);
  assertDirectTRenders(contact, CONTACT_SOURCES);
});

test('Dashboard and Login register and render only Hebrew dynamic errors, never credentials or returned passwords', () => {
  const dashboard = read('components/Dashboard.js');
  const login = read('app/(auth)/login/LoginClient.js');

  assertRegisteredSourceList(login, 'LOGIN_HEBREW_SOURCES', LOGIN_SOURCES);
  assertDirectTRenders(login, LOGIN_SOURCES.slice(1));
  assertTRendersExpressions(login, ['fetchError', 'loginError']);

  for (const [source, component, errors, secrets] of [
    [dashboard, 'Dashboard', ['error', 'recoveryError'], ['password', 'recoveryPin', 'recoveredPassword']],
    [login, 'LoginClient', ['fetchError', 'loginError'], ['username', 'pin', 'fetchedPassword']],
  ]) {
    const input = translationInput(source);
    assert.ok(source.includes('const hasHebrew = (value) => /[\\u0590-\\u05FF]/.test(value);'),
      `${component} must test dynamic values for Hebrew before registration`);
    assert.match(input, new RegExp(`\\[${errors.join(', ')}\\]\\.filter\\(hasHebrew\\)`),
      `${component} must register dynamic errors only through the Hebrew filter`);
    for (const secret of secrets) {
      assert.doesNotMatch(input, new RegExp(`\\b${secret}\\b`),
        `${component} must not register ${secret}`);
    }
  }
});

test('global translation consumers do not mutate rendered text through the DOM', () => {
  const source = [
    'components/layout/Header.js', 'components/layout/Footer.js', 'components/Dashboard.js',
    'app/about/page.js', 'app/contactUs/page.js', 'app/(auth)/login/LoginClient.js',
  ].map(read).join('\n');

  assert.doesNotMatch(source, /createTreeWalker|MutationObserver|nodeValue|textContent\s*=/);
});
