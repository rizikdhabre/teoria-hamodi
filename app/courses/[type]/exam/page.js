import { getCollection } from '@/lib/db';
import QuestionsClient from '../questions/QuestionsClient';
export default async function QuestionsPage({ params }) {
  const { type } = await params;
  const collection = await getCollection(`${type}questions`);
  function randomNumbers() {
    const set = new Set();
    while (set.size < 30) {
      set.add(Math.floor(Math.random() * 1275) + 1);
    }
    return [...set];
  }

  const randomIds = randomNumbers();

  const questions = await collection
    .find({ id: { $in: randomIds } }, { projection: { _id: 0 } })
    .limit(30)
    .toArray();

  return (
    <div className="pt-10">
      <QuestionsClient
        type={type}
        initialQuestions={questions}
        initialOffset={30}
        isexam={true}
      />
    </div>
  );
}
