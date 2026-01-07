import { fetchQuestionsByRange, fetchQuestionsCount } from "../actions";
import QuestionsClient from "./QuestionsClient";

export default async function QuestionsPage({ params }) {
  const { type } = params;

  const [initialQuestions, totalCount] = await Promise.all([
    fetchQuestionsByRange(type, 1, 10),
    fetchQuestionsCount(type),
  ]);

  return (
    <QuestionsClient
      type={type}
      initialQuestions={initialQuestions}
      totalCount={totalCount}
      rangeSize={10}
    />
  );
}
