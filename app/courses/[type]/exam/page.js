import { getCollection } from '@/lib/db';
import { getQuestionCollectionName } from '@/lib/courseTypes.mjs';
import { requireCourseAccess } from '@/lib/server/courseAccess';
import { getCurrentAudioMap } from '@/lib/ttsProfile';
import ExamClient from './ExamClient';

function serializeExamQuestion(question, source) {
  return {
    docId: question._id.toString(),
    id: question.id, // keep original id for static images
    source,
    hasImage: question.hasImage,
    image: question.image,
    audio: getCurrentAudioMap(question),
    translations: question.translations,
  };
}

// This replaces getRandomIds()
// It randomly picks REAL existing documents from MongoDB
async function getRandomQuestions(collection, count, source) {
  const questions = await collection
    .aggregate([{ $sample: { size: count } }])
    .toArray();

  return questions.map((q) => serializeExamQuestion(q, source));
}

export default async function ExamPage({ params }) {
  const { type } = params;
  const { type: validatedType } = await requireCourseAccess(
    type,
    '/courses/' + type + '/exam'
  );

  const totalSize = validatedType === 'boat' ? 50 : 30;

  const collectionName = getQuestionCollectionName(validatedType);
  const mainCollection = await getCollection(collectionName);

  let questions = [];

  // SAME LOGIC AS BEFORE:
  // For all types except boat/jetski:
  // 25 car questions + remaining questions from selected type
  if (validatedType !== 'boat' && validatedType !== 'jetski') {
    const carCollection = await getCollection('carquestions');

    const carQuestions = await getRandomQuestions(
      carCollection,
      25,
      'car'
    );

    const mainQuestions = await getRandomQuestions(
      mainCollection,
      totalSize - 25, // same as before: 5
      validatedType
    );

    questions = [...carQuestions, ...mainQuestions];
  }

  else {
    questions = await getRandomQuestions(
      mainCollection,
      totalSize,
      validatedType
    );
  }

  return (
    <div className="pt-10">
      <ExamClient type={validatedType} questions={questions} />
    </div>
  );
}
