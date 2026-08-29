"use server";

import { getCollection } from "@/lib/db";
import { getQuestionCollectionName } from "@/lib/courseTypes.mjs";
import { requireCourseAccess } from "@/lib/server/courseAccess";
import { getCurrentAudioMap } from "@/lib/ttsProfile";

export async function fetchQuestionsByRange(type, from, to) {
  const { type: validatedType } = await requireCourseAccess(
    type,
    '/courses/' + type + '/questions'
  );
  const collectionName = getQuestionCollectionName(validatedType);
  const collection = await getCollection(collectionName);

  const limit = to - from + 1;
  const skip = from - 1;

  const questions = await collection
    .find({})
    .sort({ id: 1 })
    .skip(skip)
    .limit(limit)
    .toArray();

  return questions.map((q) => ({
    docId: q._id.toString(),

    // IMPORTANT:
    // keep original id because images/audio depend on it
    id: q.id,

    hasImage: q.hasImage,
    image: q.image,
    audio: getCurrentAudioMap(q),
    translations: q.translations,
  }));
}

export async function fetchQuestionsCount(type) {
  const { type: validatedType } = await requireCourseAccess(
    type,
    '/courses/' + type + '/questions'
  );
  const collectionName = getQuestionCollectionName(validatedType);
  const collection = await getCollection(collectionName);
  return collection.countDocuments();
}
