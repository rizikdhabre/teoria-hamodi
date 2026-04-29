"use server";
import { getCollection } from "@/lib/db";

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
    audio: q.audio || null,
    translations: q.translations,
  }));
}

export async function fetchQuestionsCount(type) {
  const collection = await getCollection(`${type}questions`);
  return collection.countDocuments();
}