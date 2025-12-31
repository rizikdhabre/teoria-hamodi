"use server";

import { getCollection } from "@/lib/db";

export async function fetchMoreQuestions(type, offset) {
  const collection = await getCollection(`${type}questions`);

  return await collection
    .find({}, { projection: { _id: 0 } })
    .sort({ id: 1 })
    .skip(offset)
    .limit(40)
    .toArray();
}
