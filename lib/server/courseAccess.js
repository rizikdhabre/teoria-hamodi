import { getServerSession } from 'next-auth';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createCourseAccessGuard } from '@/lib/courseAccessPolicy.mjs';
import { getCourseAccessRoutingDecision } from '@/lib/courseAccessRouting.mjs';
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
    const decision = getCourseAccessRoutingDecision(error, type, requestedPath);
    if (decision.action === 'redirect') {
      return redirect(decision.destination);
    }
    if (decision.action === 'notFound') {
      return notFound();
    }
    throw decision.error;
  }
}
