import {
  AuthenticationRequiredError,
  SeaCourseGrantRequiredError,
} from './courseAccessPolicy.mjs';
import {
  InvalidCourseTypeError,
  isCourseType,
  isSeaCourse,
} from './courseTypes.mjs';

function getSafeRequestedPath(type, requestedPath) {
  const coursePath = '/courses/' + type;
  const allowedPaths = [
    coursePath,
    coursePath + '/questions',
    coursePath + '/exam',
  ];
  return allowedPaths.includes(requestedPath) ? requestedPath : coursePath;
}

export function getCourseAccessRoutingDecision(error, type, requestedPath) {
  if (error instanceof AuthenticationRequiredError) {
    let callbackUrl = '/';
    if (isCourseType(type)) {
      callbackUrl = isSeaCourse(type)
        ? '/?courseAccess=' + type
        : getSafeRequestedPath(type, requestedPath);
    }
    return {
      action: 'redirect',
      destination: '/login?callbackUrl=' + encodeURIComponent(callbackUrl),
    };
  }

  if (error instanceof InvalidCourseTypeError) {
    return { action: 'notFound' };
  }

  if (error instanceof SeaCourseGrantRequiredError) {
    if (!isCourseType(type) || !isSeaCourse(type)) {
      return { action: 'notFound' };
    }
    return {
      action: 'redirect',
      destination:
        error.reason === 'missing'
          ? '/?courseAccess=' + type
          : '/courses/access/clear?type=' + type,
    };
  }

  return { action: 'rethrow', error };
}
