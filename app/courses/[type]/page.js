import { isSeaCourse } from '@/lib/courseTypes.mjs';
import { requireCourseAccess } from '@/lib/server/courseAccess';
import CourseLandingClient from './CourseLandingClient';

export default async function CoursePage({ params }) {
  const { type } = params;
  const { type: validatedType } = await requireCourseAccess(
    type,
    '/courses/' + type
  );
  return (
    <CourseLandingClient
      type={validatedType}
      isSeaCourse={isSeaCourse(validatedType)}
    />
  );
}
