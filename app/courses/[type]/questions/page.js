import { fetchQuestionsByRange, fetchQuestionsCount } from "../actions";
import QuestionsClient from "./QuestionsClient";
import { requireCourseAccess } from "@/lib/server/courseAccess";

export default async function QuestionsPage({ params }) {
  const { type } = params;
  const { type: validatedType } = await requireCourseAccess(
    type,
    '/courses/' + type + '/questions'
  );

  const [initialQuestions, totalCount] = await Promise.all([
    fetchQuestionsByRange(validatedType, 1, 10),
    fetchQuestionsCount(validatedType),
  ]);

  return (
    <QuestionsClient
      type={validatedType}
      initialQuestions={initialQuestions}
      totalCount={totalCount}
      rangeSize={10}
    />
  );
}
