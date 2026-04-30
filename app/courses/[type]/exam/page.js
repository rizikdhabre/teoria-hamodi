import { getCollection } from '@/lib/db';
import { getCurrentAudioMap } from '@/lib/ttsProfile';
import ExamClient from './ExamClient';

function serializeExamQuestion(question, source) {
  return {
    docId: question._id.toString(),
    id: question.id,
    source,
    hasImage: question.hasImage,
    image: question.image,
    audio: getCurrentAudioMap(question),
    translations: question.translations,
  };
}

export default async function ExamPage({ params }) {
  const { type } = params;

  let totalSize = type === 'boat' ? 50 : 30;

  const mainCollection = await getCollection(`${type}questions`);

  // helper
  function getRandomIds(max, count) {
    const set = new Set();
    while (set.size < count) {
      // eslint-disable-next-line react-hooks/purity
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
        .find({ id: { $in: carIds } })
        .toArray()
    ).map((q) => serializeExamQuestion(q, 'car'));

    const mainQuestions = (
      await mainCollection
        .find({ id: { $in: mainIds } })
        .toArray()
    ).map((q) => serializeExamQuestion(q, type));

    questions = [...carQuestions, ...mainQuestions];
  }
 
  else {
    const count = await mainCollection.countDocuments();
    const ids = getRandomIds(count, totalSize);

    questions = (
      await mainCollection
        .find({ id: { $in: ids } })
        .toArray()
    ).map((q) => serializeExamQuestion(q, type));
  }

  return (
    <div className="pt-10">
      <ExamClient type={type} questions={questions} />
    </div>
  );
}
