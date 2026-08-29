export const COURSE_TYPES = Object.freeze([
  'motorcycle',
  'car',
  'truck',
  'cTruck',
  'bus',
  'tractor',
  'jetski',
  'boat',
]);

export const SEA_COURSE_TYPES = Object.freeze(['jetski', 'boat']);

const COURSE_SET = new Set(COURSE_TYPES);

export class InvalidCourseTypeError extends Error {
  constructor(message = 'Invalid course type') {
    super(message);
    this.name = 'InvalidCourseTypeError';
  }
}

export function isCourseType(value) {
  return typeof value === 'string' && COURSE_SET.has(value);
}

export function assertCourseType(value) {
  if (!isCourseType(value)) throw new InvalidCourseTypeError();
  return value;
}

export function isSeaCourse(value) {
  return SEA_COURSE_TYPES.includes(assertCourseType(value));
}

export function getQuestionCollectionName(value) {
  return assertCourseType(value) + 'questions';
}
