import { assertCourseType, isSeaCourse } from './courseTypes.mjs';

export class AuthenticationRequiredError extends Error {
  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationRequiredError';
  }
}

export class SeaCourseGrantRequiredError extends Error {
  constructor(reason) {
    super(
      reason === 'missing'
        ? 'Sea course grant is missing'
        : 'Sea course grant is invalid'
    );
    this.name = 'SeaCourseGrantRequiredError';
    this.reason = reason;
  }
}

export function createCourseAccessGuard({
  getSession,
  readSeaCourseCookie,
  verifyGrant,
  assertType = assertCourseType,
}) {
  async function requireAuthenticatedUser() {
    const session = await getSession();
    const userId = session?.user?.id;
    if (typeof userId !== 'string' || userId.trim().length === 0) {
      throw new AuthenticationRequiredError();
    }
    return { session, userId };
  }

  async function requireAuthenticatedCourseType(type) {
    const authentication = await requireAuthenticatedUser();
    const validatedType = assertType(type);
    return { ...authentication, type: validatedType };
  }

  async function requireCourseAccess(type) {
    const context = await requireAuthenticatedCourseType(type);
    if (!isSeaCourse(context.type)) return context;

    const token = await readSeaCourseCookie();
    if (token === undefined || token === null || token === '') {
      throw new SeaCourseGrantRequiredError('missing');
    }
    if (!(await verifyGrant(token, context.userId))) {
      throw new SeaCourseGrantRequiredError('invalid');
    }
    return context;
  }

  return {
    requireAuthenticatedUser,
    requireAuthenticatedCourseType,
    requireCourseAccess,
  };
}
