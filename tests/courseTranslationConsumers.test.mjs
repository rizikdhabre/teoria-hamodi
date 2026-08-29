import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import babelParser from 'next/dist/compiled/babel/parser.js';
import { createTranslationState } from '../lib/translationState.mjs';

const { parse } = babelParser;

const read = (file) =>
  readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').replace(
    /\r\n?/g,
    '\n'
  );

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

function parseSource(source) {
  return parse(source, { sourceType: 'module', plugins: ['jsx'] });
}

function walkAst(node, visit, ancestors = []) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const child of node) walkAst(child, visit, ancestors);
    return;
  }

  const nextAncestors = typeof node.type === 'string'
    ? [...ancestors, node]
    : ancestors;
  if (typeof node.type === 'string') visit(node, ancestors);

  for (const [key, child] of Object.entries(node)) {
    if (key === 'loc' || key === 'start' || key === 'end') continue;
    walkAst(child, visit, nextAncestors);
  }
}

function translationInputs(source) {
  const inputs = [];
  walkAst(parseSource(source), (node) => {
    if (
      node.type !== 'CallExpression' ||
      node.callee.type !== 'Identifier' ||
      node.callee.name !== 'useTranslationStrings'
    ) {
      return;
    }

    inputs.push(
      node.arguments.length === 1 && node.arguments[0].type === 'Identifier'
        ? node.arguments[0].name
        : null
    );
  });
  return inputs;
}

function assertTranslationRegistrations(source, constant) {
  assert.deepEqual(
    translationInputs(source),
    [constant],
    'consumer must have exactly one audited useTranslationStrings registration'
  );
}

function liveTranslationCounts(source) {
  const counts = new Map();
  walkAst(parseSource(source), (node, ancestors) => {
    const parent = ancestors.at(-1);
    if (
      node.type !== 'CallExpression' ||
      node.callee.type !== 'Identifier' ||
      node.callee.name !== 't' ||
      node.arguments.length !== 1 ||
      node.arguments[0].type !== 'StringLiteral' ||
      parent?.type !== 'JSXExpressionContainer' ||
      parent.expression !== node
    ) {
      return;
    }

    const text = node.arguments[0].value;
    counts.set(text, (counts.get(text) ?? 0) + 1);
  });
  return counts;
}

function assertDirectTRenders(source, sources, countOverrides = {}) {
  const counts = liveTranslationCounts(source);
  for (const text of sources) {
    const expectedCount = countOverrides[text] ?? 1;
    assert.equal(
      counts.get(text) ?? 0,
      expectedCount,
      `expected ${expectedCount} direct JSX translation expression for ${text}`
    );
  }
  assert.deepEqual(
    [...counts.keys()].sort(),
    [...sources].sort(),
    'live JSX translation calls must use only audited registered sources'
  );
}

function registerExtractedSources(state, id, source, constant, expected) {
  const sources = extractStringArray(source, constant);
  assert.deepEqual(
    sources,
    expected,
    `${constant} must contain only the exact static shell sources`
  );
  assertTranslationRegistrations(source, constant);
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
  const ast = parseSource(source);
  assert.doesNotMatch(source, /^['"]use client['"];?/m);
  assert.match(
    source,
    /import CourseLandingClient from ['"]\.\/CourseLandingClient['"]/,
    'the protected Server Component must delegate presentation'
  );
  const guardIndex = source.indexOf('await requireCourseAccess(');
  const clientIndex = source.indexOf('<CourseLandingClient');
  assert.ok(guardIndex !== -1 && guardIndex < clientIndex);
  const defaultExport = ast.program.body.find(
    (node) =>
      node.type === 'ExportDefaultDeclaration' &&
      node.declaration.type === 'FunctionDeclaration' &&
      node.declaration.id?.name === 'CoursePage' &&
      node.declaration.async
  );
  assert.ok(defaultExport, 'CoursePage must remain the default async function');
  const coursePage = defaultExport.declaration;
  const returnStatement = coursePage.body.body.find(
    (node) => node.type === 'ReturnStatement'
  );
  assert.ok(returnStatement, 'CoursePage must return its client presentation');

  const returnedClient = returnStatement.argument;
  assert.ok(
    returnedClient?.type === 'JSXElement' &&
      returnedClient.openingElement.name.type === 'JSXIdentifier' &&
      returnedClient.openingElement.name.name === 'CourseLandingClient',
    'CourseLandingClient must be the direct CoursePage return value'
  );
  const typeAttribute = returnedClient.openingElement.attributes.find(
    (attribute) =>
      attribute.type === 'JSXAttribute' && attribute.name.name === 'type'
  );
  const renderedTypeIdentifiers = [];
  if (
    typeAttribute?.value?.type === 'JSXExpressionContainer' &&
    typeAttribute.value.expression.type === 'Identifier'
  ) {
    renderedTypeIdentifiers.push(typeAttribute.value.expression.name);
  }
  assert.deepEqual(
    renderedTypeIdentifiers,
    ['validatedType'],
    'CourseLandingClient must render exactly one validated type identifier'
  );

  const renderedTypeBindings = [];
  for (const statement of coursePage.body.body) {
    if (statement.type !== 'VariableDeclaration') continue;
    for (const declarator of statement.declarations) {
      if (
        declarator.id.type === 'Identifier' &&
        declarator.id.name === renderedTypeIdentifiers[0]
      ) {
        renderedTypeBindings.push({ declarator, property: null });
      }
      if (declarator.id.type !== 'ObjectPattern') continue;
      for (const property of declarator.id.properties) {
        if (
          property.type === 'ObjectProperty' &&
          property.value.type === 'Identifier' &&
          property.value.name === renderedTypeIdentifiers[0]
        ) {
          renderedTypeBindings.push({ declarator, property });
        }
      }
    }
  }

  const [{ declarator, property } = {}] = renderedTypeBindings;
  const guardCall = declarator?.init?.type === 'AwaitExpression'
    ? declarator.init.argument
    : null;
  assert.ok(
    renderedTypeBindings.length === 1 &&
      property?.key?.type === 'Identifier' &&
      property.key.name === 'type' &&
      guardCall?.type === 'CallExpression' &&
      guardCall.callee.type === 'Identifier' &&
      guardCall.callee.name === 'requireCourseAccess' &&
      guardCall.arguments[0]?.type === 'Identifier' &&
      guardCall.arguments[0].name === 'type',
    'rendered type binding must be the top-level guard-result property'
  );
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
  assertDirectTRenders(exam, EXAM_SOURCES, { הגש: 2 });
});

test('question documents and audio never enter page translation registration', () => {
  const questions = read('app/courses/[type]/questions/QuestionsClient.js');
  const exam = read('app/courses/[type]/exam/ExamClient.js');

  for (const [source, constant] of [
    [questions, 'QUESTION_SHELL_HEBREW_SOURCES'],
    [exam, 'EXAM_SHELL_HEBREW_SOURCES'],
  ]) {
    assertTranslationRegistrations(source, constant);
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
  const leakMutation = questions.replace(
    'const t = useTranslationStrings(QUESTION_SHELL_HEBREW_SOURCES);',
    `const t = useTranslationStrings(QUESTION_SHELL_HEBREW_SOURCES);
  useTranslationStrings(initialQuestions);`
  );
  const provenanceMutation = page.replace(
    'const { type: validatedType } = await requireCourseAccess(',
    'const validatedType = type;\n  await requireCourseAccess('
  );
  const nestedDecoyMutation = page.replace(
    `const { type: validatedType } = await requireCourseAccess(
    type,
    '/courses/' + type
  );`,
    `const validatedType = type;
  await requireCourseAccess(type, '/courses/' + type);
  async function unusedGuardDecoy() {
    const { type: validatedType } = await requireCourseAccess(type);
    return validatedType;
  }`
  );
  const nestedReturnMutation = page.replace(
    `return (
    <CourseLandingClient
      type={validatedType}
      isSeaCourse={isSeaCourse(validatedType)}
    />
  );`,
    `return (() => {
    const validatedType = type;
    return (
      <CourseLandingClient
        type={validatedType}
        isSeaCourse={isSeaCourse(validatedType)}
      />
    );
  })();`
  );
  const deadRenderMutation = `${questions.replace(
    "{t('מפת שאלות')}",
    "{'מפת שאלות'}"
  )}\n// t('מפת שאלות')`;
  const falseLogicalMutation = questions.replace(
    "{t('מפת שאלות')}",
    "{'מפת שאלות'}{false && t('מפת שאלות')}"
  );

  assert.throws(
    () =>
      registerExtractedSources(
        createTranslationState(),
        'questions',
        leakMutation,
        'QUESTION_SHELL_HEBREW_SOURCES',
        QUESTION_SOURCES
      ),
    /exactly one audited useTranslationStrings registration/
  );
  assert.throws(
    () => assertServerDelegation(provenanceMutation),
    /rendered type binding must be the top-level guard-result property/
  );
  assert.throws(
    () => assertServerDelegation(nestedDecoyMutation),
    /rendered type binding must be the top-level guard-result property/
  );
  assert.throws(
    () => assertServerDelegation(nestedReturnMutation),
    /CourseLandingClient must be the direct CoursePage return value/
  );
  assert.throws(
    () => assertDirectTRenders(deadRenderMutation, QUESTION_SOURCES),
    /direct JSX translation expression for מפת שאלות/
  );
  assert.throws(
    () => assertDirectTRenders(falseLogicalMutation, QUESTION_SOURCES),
    /direct JSX translation expression for מפת שאלות/
  );

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
