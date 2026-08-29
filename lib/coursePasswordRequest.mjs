import { AuthenticationRequiredError } from './courseAccessPolicy.mjs';

export class CoursePasswordBadRequestError extends Error {
  constructor(message = 'Invalid course password request') {
    super(message);
    this.name = 'CoursePasswordBadRequestError';
  }
}

export async function readCoursePassword(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    throw new CoursePasswordBadRequestError();
  }

  const password = body?.password;
  if (
    typeof password !== 'string' ||
    password.length < 1 ||
    password.length > 256
  ) {
    throw new CoursePasswordBadRequestError();
  }
  return password;
}

export function getCoursePasswordErrorResponse(error) {
  if (error instanceof AuthenticationRequiredError) {
    return {
      status: 401,
      body: { message: 'Authentication required' },
    };
  }
  if (error instanceof CoursePasswordBadRequestError) {
    return { status: 400, body: { message: 'Invalid request' } };
  }
  return {
    status: 500,
    body: { message: 'Internal server error' },
  };
}
