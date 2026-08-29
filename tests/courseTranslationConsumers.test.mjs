import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createTranslationState } from '../lib/translationState.mjs';

const read = (file) =>
  readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

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
      escaped = false;
      continue;
    }
    if (char === open) depth += 1;
    if (char === close && --depth === 0) {
      return source.slice(start + 1, index);
    }
  }

  throw new Error(`Unclosed ${open} in source`);
}

function extractStringArray(source, constant) {
  const marker = `const ${constant} = [`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${constant} must be a stable top-level source list`);
  const contents = balancedContents(
    source,
    start + marker.length - 1,
    '[',
    ']'
  );
  return [...contents.matchAll(/'((?:\\.|[^'])*)'/g)].map(
    (match) => match[1]
  );
}

function translationInput(source) {
  const marker = 'useTranslationStrings(';
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, 'consumer must call useTranslationStrings');
  return balancedContents(source, start + marker.length - 1, '(', ')').trim();
}

function assertDirectTRenders(source, sources) {
  for (const text of sources) {
    const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(
      source,
      new RegExp(`t\\('${escaped}'\\)`),
      `visible source ${text} must render through t`
    );
  }
}

function registerExtractedSources(state, id, source, constant, expected) {
  const sources = extractStringArray(source, constant);
  assert.deepEqual(
    sources,
    expected,
    `${constant} must contain only the exact static shell sources`
  );
  assert.equal(
    translationInput(source),
    constant,
    `${constant} must be the complete registration input`
  );
  state.register(id, sources);
}

function normalizeJs(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function extractCallArguments(source, callee) {
  const marker = `${callee}(`;
  const calls = [];
  let cursor = 0;

  while (cursor < source.length) {
    const start = source.indexOf(marker, cursor);
    if (start === -1) break;
    calls.push(
      normalizeJs(
        balancedContents(source, start + marker.length - 1, '(', ')')
      )
    );
    cursor = start + marker.length;
  }

  return calls;
}

function assertServerDelegation(source) {
  assert.doesNotMatch(source, /^['"]use client['"];?/m);
  assert.match(
    source,
    /import CourseLandingClient from ['"]\.\/CourseLandingClient['"]/,
    'the protected Server Component must delegate presentation'
  );
  const guardIndex = source.indexOf('await requireCourseAccess(');
  const clientIndex = source.indexOf('<CourseLandingClient');
  assert.ok(guardIndex !== -1 && guardIndex < clientIndex);
  assert.match(
    source,
    /<CourseLandingClient\s+type=\{validatedType\}\s+isSeaCourse=\{isSeaCourse\(validatedType\)\}\s*\/>/s
  );
  assert.doesNotMatch(source, /<table\b|<Link\b|href=/);
}

function assertQuestionResolution(questionSource, examSource) {
  assert.match(
    questionSource,
    /const t = q\.translations\?\.\[lang\.toLowerCase\(\)\] \|\| q\.translations\?\.he;/
  );
  assert.match(
    questionSource,
    /const resolvedAudio = q\.audio\?\.\[lang\.toLowerCase\(\)\] \|\| null;/
  );
  assert.match(questionSource, /question: t\.question,\s+options: t\.options,/s);

  assert.match(examSource, /function resolveQuestion\(question, lang\)/);
  assert.match(
    examSource,
    /question\.translations\?\.\[lang\.toLowerCase\(\)\] \|\|\s+question\.translations\?\.he/s
  );
  assert.match(
    examSource,
    /question\.audio\?\.\[lang\.toLowerCase\(\)\] \|\| null/
  );
  assert.match(
    examSource,
    /question: translation\.question,\s+options: translation\.options,/s
  );
  assert.match(
    examSource,
    /Object\.entries\(translation\.options\)\.find\(/,
    'exam scoring must continue using the selected document translation'
  );
}

const LANDING_SOURCES = [
  'קישור',
  'תיאור',
  'תור לקביעת תיאוריה',
  'תשלום רשיונות ים',
  'תשלום אגרות ורשיונות',
  'קביעת תור לרשיונות ים',
  'זימון תור למבחן / רישיון',
  'תבחר איך אתה רוצה ללמוד את הקורס',
  'מאגר שאלות',
  'ליצירת מבחן',
];
const LOADING_SOURCES = ['טוען שאלות...'];
const QUESTION_SOURCES = [
  '☰ מפת שאלות',
  'מפת שאלות',
  '→ אחורה',
  'הבא ←',
];
const EXAM_SOURCES = [
  'סיכום טעויות',
  'שאלה',
  'התשובה הנכונה',
  'התשובה שלך',
  'מבחן – שאלות',
  'הגש',
  'טעויות רגילות מותרות:',
  'טעויות בשאלות חובה:',
  'מפת המבחן',
  '→ אחורה',
  'הבא ←',
];

test('protected course page guards the validated type and delegates presentation only', () => {
  const page = read('app/courses/[type]/page.js');
  const client = read('app/courses/[type]/CourseLandingClient.js');

  assertServerDelegation(page);
  assert.match(client, /^['"]use client['"];?/m);
  assert.match(
    client,
    /function CourseLandingClient\(\{ type, isSeaCourse \}\)/
  );
  assert.doesNotMatch(
    client,
    /requireCourseAccess|getServerSession|cookies\(|NEXTAUTH_SECRET|sea_course_access|getCollection/
  );
  assert.match(client, /href=\{`\/courses\/\$\{type\}\/questions`\}/);
  assert.match(client, /href=\{`\/courses\/\$\{type\}\/exam`\}/);
});

test('course shell consumers register exact sources and expose them to translation state', () => {
  const state = createTranslationState();
  const landing = read('app/courses/[type]/CourseLandingClient.js');
  const loading = read('app/courses/[type]/loading.js');
  const questions = read('app/courses/[type]/questions/QuestionsClient.js');
  const exam = read('app/courses/[type]/exam/ExamClient.js');

  registerExtractedSources(
    state,
    'landing',
    landing,
    'COURSE_LANDING_HEBREW_SOURCES',
    LANDING_SOURCES
  );
  registerExtractedSources(
    state,
    'loading',
    loading,
    'COURSE_LOADING_HEBREW_SOURCES',
    LOADING_SOURCES
  );
  registerExtractedSources(
    state,
    'questions',
    questions,
    'QUESTION_SHELL_HEBREW_SOURCES',
    QUESTION_SOURCES
  );
  registerExtractedSources(
    state,
    'exam',
    exam,
    'EXAM_SHELL_HEBREW_SOURCES',
    EXAM_SOURCES
  );

  state.setScope('/courses/car/questions', 'EN');
  assert.deepEqual(state.createRequest().sources, [
    ...LANDING_SOURCES,
    ...LOADING_SOURCES,
    ...QUESTION_SOURCES,
    ...EXAM_SOURCES.filter(
      (source) => !QUESTION_SOURCES.includes(source)
    ),
  ]);
});

test('every registered course shell source is rendered through t', () => {
  const landing = read('app/courses/[type]/CourseLandingClient.js');
  const loading = read('app/courses/[type]/loading.js');
  const questions = read('app/courses/[type]/questions/QuestionsClient.js');
  const exam = read('app/courses/[type]/exam/ExamClient.js');

  assertDirectTRenders(landing, LANDING_SOURCES);
  assertDirectTRenders(loading, LOADING_SOURCES);
  assertDirectTRenders(questions, QUESTION_SOURCES);
  assertDirectTRenders(exam, EXAM_SOURCES);
  assert.equal(
    (questions.match(/t\('מפת שאלות'\)/g) ?? []).length,
    1,
    'the second map label has a distinct icon-bearing source'
  );
  assert.equal(
    (exam.match(/t\('הגש'\)/g) ?? []).length,
    2,
    'both exam submit controls must react to language changes'
  );
});

test('question documents and audio never enter page translation registration', () => {
  const questions = read('app/courses/[type]/questions/QuestionsClient.js');
  const exam = read('app/courses/[type]/exam/ExamClient.js');

  for (const [name, source, constant] of [
    ['QuestionsClient', questions, 'QUESTION_SHELL_HEBREW_SOURCES'],
    ['ExamClient', exam, 'EXAM_SHELL_HEBREW_SOURCES'],
  ]) {
    assert.equal(
      translationInput(source),
      constant,
      `${name} must register its audited presentation constant only`
    );
  }

  assertQuestionResolution(questions, exam);
});

test('question speech hooks, preload calls, and TTS payloads keep their existing paths', () => {
  const questions = read('app/courses/[type]/questions/QuestionsClient.js');
  const exam = read('app/courses/[type]/exam/ExamClient.js');

  for (const source of [questions, exam]) {
    assert.match(
      source,
      /import \{ useQuestionSpeech \} from ['"]@\/lib\/useQuestionSpeech['"];/
    );
  }

  assert.deepEqual(extractCallArguments(questions, 'useQuestionSpeech'), [
    'lang',
    'lang',
  ]);
  assert.deepEqual(extractCallArguments(questions, 'preload'), [
    'preloadItems',
  ]);
  assert.deepEqual(extractCallArguments(questions, 'speak'), [
    "{ collectionName: `${type}questions`, docId: question.docId, type: 'question', id: 'q', }",
    "{ collectionName: `${type}questions`, docId: question.docId, type: 'option', optionKey: key, id: key, }",
  ]);

  assert.deepEqual(extractCallArguments(exam, 'useQuestionSpeech'), [
    'lang',
    'lang',
    'lang',
  ]);
  assert.deepEqual(extractCallArguments(exam, 'preload'), ['preloadItems']);
  assert.deepEqual(extractCallArguments(exam, 'speak'), [
    "{ ...audioPayload, type: 'question', id: 'q', includeOptions: true, }",
    "{ ...audioPayload, type: 'option', optionKey: key, id: key, includeOptions: true, }",
    "{ ...audioPayload, type: 'question', id: 'question', includeOptions: true, }",
    "{ ...audioPayload, type: 'option', optionKey: result.correctKey, id: 'correct', includeOptions: true, }",
    "{ ...audioPayload, type: 'option', optionKey: result.userKey, id: 'user', includeOptions: true, }",
  ]);
});

test('course consumers no longer rely on DOM translation opt-out markers or mutation', () => {
  const source = [
    'app/courses/[type]/CourseLandingClient.js',
    'app/courses/[type]/loading.js',
    'app/courses/[type]/questions/QuestionsClient.js',
    'app/courses/[type]/exam/ExamClient.js',
  ]
    .map(read)
    .join('\n');

  assert.doesNotMatch(source, /data-no-translate|translate=['"]no['"]/);
  assert.doesNotMatch(
    source,
    /createTreeWalker|MutationObserver|nodeValue|innerText|textContent\s*=/
  );
});

test('contract checks reject realistic validated-type, rendering, and audio mutations', () => {
  const page = read('app/courses/[type]/page.js');
  const questions = read('app/courses/[type]/questions/QuestionsClient.js');
  const exam = read('app/courses/[type]/exam/ExamClient.js');

  assert.throws(
    () =>
      assertServerDelegation(
        page.replace('type={validatedType}', 'type={type}')
      ),
    /CourseLandingClient/
  );
  assert.throws(
    () =>
      assertDirectTRenders(
        questions.replace("t('מפת שאלות')", "'מפת שאלות'"),
        QUESTION_SOURCES
      ),
    /מפת שאלות/
  );
  assert.throws(
    () =>
      assertQuestionResolution(
        questions,
        exam.replace(
          'question.audio?.[lang.toLowerCase()] || null',
          'null'
        )
      ),
    /question\\\.audio/
  );
});
