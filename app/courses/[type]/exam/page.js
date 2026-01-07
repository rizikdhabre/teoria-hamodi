import { getCollection } from '@/lib/db';
import ExamClient from './ExamClient';

export default async function ExamPage({ params }) {
  const { type } = params;

  const collection = await getCollection(`${type}questions`);
  const length = await collection.countDocuments();

  function randomNumbers() {
    const set = new Set();
    while (set.size < 30) {
      set.add(Math.floor(Math.random() * length) + 1);
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
      <ExamClient type={type} questions={questions} />
    </div>
  );
}
