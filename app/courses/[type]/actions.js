"use server";
import { getCollection } from "@/lib/db";
import { getCurrentAudioMap } from "@/lib/ttsProfile";

export async function fetchQuestionsByRange(type, from, to) {
  const collection = await getCollection(`${type}questions`);

  const questions = await collection
    .find({ id: { $gte: from, $lte: to } })
    .sort({ id: 1 })
    .toArray();


  return questions.map((q) => ({
    docId: q._id.toString(),  
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