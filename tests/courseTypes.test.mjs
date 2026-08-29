import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COURSE_TYPES,
  SEA_COURSE_TYPES,
  InvalidCourseTypeError,
  assertCourseType,
  getQuestionCollectionName,
  isCourseType,
  isSeaCourse,
} from '../lib/courseTypes.mjs';

test('exposes exactly the eight canonical course types in stable order', () => {
  const expected = [
    'motorcycle',
    'car',
    'truck',
    'cTruck',
    'bus',
    'tractor',
    'jetski',
    'boat',
  ];
  assert.deepEqual(COURSE_TYPES, expected);
  assert.deepEqual(SEA_COURSE_TYPES, ['jetski', 'boat']);
  assert.equal(Object.isFrozen(COURSE_TYPES), true);
  assert.equal(Object.isFrozen(SEA_COURSE_TYPES), true);
});

test('accepts canonical types and derives only canonical collection names', () => {
  const expected = [
    'motorcycle',
    'car',
    'truck',
    'cTruck',
    'bus',
    'tractor',
    'jetski',
    'boat',
  ];
  for (const type of expected) {
    assert.equal(isCourseType(type), true);
    assert.equal(assertCourseType(type), type);
    assert.equal(getQuestionCollectionName(type), type + 'questions');
  }
  assert.equal(isCourseType('Car'), false);
  assert.equal(isCourseType(null), false);
  assert.throws(
    () => getQuestionCollectionName('../users'),
    InvalidCourseTypeError
  );
});

test('validates a type before a database accessor can be reached', () => {
  let dbCalls = 0;
  assert.throws(() => {
    const type = assertCourseType('unknown');
    dbCalls += 1;
    return type;
  }, InvalidCourseTypeError);
  assert.equal(dbCalls, 0);
});

test('identifies only validated sea course types', () => {
  assert.equal(isSeaCourse('jetski'), true);
  assert.equal(isSeaCourse('boat'), true);
  assert.equal(isSeaCourse('car'), false);
  assert.throws(() => isSeaCourse('unknown'), InvalidCourseTypeError);
});
