import { getCollection } from '@/lib/db';
import ExamClient from './ExamClient';

export default async function ExamPage({ params }) {
  const { type } = params;

  let totalSize = type === 'boat' ? 50 : 30;

  const mainCollection = await getCollection(`${type}questions`);

  // helper
  function getRandomIds(max, count) {
    const set = new Set();
    while (set.size < count) {
      set.add(Math.floor(Math.random() * max) + 1);
    }
    return [...set];
  }

  let questions = [];

 
  if (type !== 'boat' && type !== 'jetski') {
    const carCollection = await getCollection('carquestions');

    const carCount = await carCollection.countDocuments();
    const mainCount = await mainCollection.countDocuments();

    const carIds = getRandomIds(carCount, 25);
    const mainIds = getRandomIds(mainCount, totalSize - 25); // 5

    const carQuestions = (
      await carCollection
        .find({ id: { $in: carIds } }, { projection: { _id: 0 } })
        .toArray()
    ).map((q) => ({ ...q, source: 'car' }));

    const mainQuestions = (
      await mainCollection
        .find({ id: { $in: mainIds } }, { projection: { _id: 0 } })
        .toArray()
    ).map((q) => ({ ...q, source: type }));

    questions = [...carQuestions, ...mainQuestions];
  }
 
  else {
    const count = await mainCollection.countDocuments();
    const ids = getRandomIds(count, totalSize);

    questions = (
      await mainCollection
        .find({ id: { $in: ids } }, { projection: { _id: 0 } })
        .toArray()
    ).map((q) => ({
      ...q,
      source: type, 
    }));
  }

  return (
    <div className="pt-10">
      <ExamClient type={type} questions={questions} />
    </div>
  );
}
