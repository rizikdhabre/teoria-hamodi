"use server";
import { getCollection } from "@/lib/db";

export async function fetchQuestionsByRange(type, from, to) {
  const collection = await getCollection(`${type}questions`);
  return collection
    .find({ id: { $gte: from, $lte: to } }, { projection: { _id: 0 } })
    .sort({ id: 1 })
    .toArray();
}



export async function fetchQuestionsCount(type) {
  const collection = await getCollection(`${type}questions`);
  return collection.countDocuments();
}
