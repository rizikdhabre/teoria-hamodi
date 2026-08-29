import { getServerSession } from 'next-auth';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import {
  AuthenticationRequiredError,
  SeaCourseGrantRequiredError,
  createCourseAccessGuard,
} from '@/lib/courseAccessPolicy.mjs';
import {
  InvalidCourseTypeError,
  isCourseType,
  isSeaCourse,
} from '@/lib/courseTypes.mjs';
import {
  SEA_COURSE_COOKIE_NAME,
  verifySeaCourseGrant,
} from '@/lib/server/seaCourseGrant.mjs';

const courseAccessGuard = createCourseAccessGuard({
  getSession() {
    return getServerSession(authOptions);
  },
  readSeaCourseCookie() {
    return cookies().get(SEA_COURSE_COOKIE_NAME)?.value;
  },
  verifyGrant(token, userId) {
    return verifySeaCourseGrant(token, userId, process.env.NEXTAUTH_SECRET);
  },
});

function getSafeRequestedPath(type, requestedPath) {
  const coursePath = '/courses/' + type;
  const allowedPaths = [
    coursePath,
    coursePath + '/questions',
    coursePath + '/exam',
  ];
  return allowedPaths.includes(requestedPath) ? requestedPath : coursePath;
}

export async function requireAuthenticatedUser() {
  return courseAccessGuard.requireAuthenticatedUser();
}

export async function requireAuthenticatedCourseType(type) {
  return courseAccessGuard.requireAuthenticatedCourseType(type);
}

export async function requireCourseAccess(type, requestedPath) {
  try {
    return await courseAccessGuard.requireCourseAccess(type);
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      let callbackUrl = '/';
      if (isCourseType(type)) {
        callbackUrl = isSeaCourse(type)
          ? '/?courseAccess=' + type
          : getSafeRequestedPath(type, requestedPath);
      }
      return redirect('/login?callbackUrl=' + encodeURIComponent(callbackUrl));
    }

    if (error instanceof InvalidCourseTypeError) {
      return notFound();
    }

    if (error instanceof SeaCourseGrantRequiredError) {
      if (!isCourseType(type) || !isSeaCourse(type)) return notFound();
      if (error.reason === 'missing') {
        return redirect('/?courseAccess=' + type);
      }
      return redirect('/courses/access/clear?type=' + type);
    }

    throw error;
  }
}
