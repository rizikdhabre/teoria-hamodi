"use server";

import { getCollection } from "@/lib/db";
import { getCurrentAudioMap } from "@/lib/ttsProfile";

export async function fetchQuestionsByRange(type, from, to) {
  const collection = await getCollection(`${type}questions`);

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
  const collection = await getCollection(`${type}questions`);
  return collection.countDocuments();
}