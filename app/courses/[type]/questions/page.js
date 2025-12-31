import { getCollection } from "@/lib/db";
import QuestionsClient from "./QuestionsClient";
export default async function QuestionsPage({ params }) {
  const { type } = await params;

  const collection = await getCollection(`${type}questions`);

const questions = await collection
  .find({}, { projection: { _id: 0 } })
  .sort({ id: 1 })
  .limit(40)
  .toArray();

  return (
<div className="pt-10">
      <QuestionsClient
      type={type}
      initialQuestions={questions}
      initialOffset={40}
      isexam={false}
    />
</div>
  );
}
