import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getCollection } from "@/lib/db";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function normalizeOne(t) {
  return (t || "").replace(/\s+/g, " ").trim();
}

export async function POST(req) {
  try {
    const { pageId, targetLang, texts } = await req.json();

    // ------------------ Validation ------------------
    if (!pageId || !targetLang || !Array.isArray(texts)) {
      return NextResponse.json(
        { error: "Invalid payload" },
        { status: 400 }
      );
    }

    // ------------------ Skip Hebrew entirely ------------------
    if (targetLang === "Hebrew") {
      return NextResponse.json({ translatedTexts: texts });
    }

    const col = await getCollection("translations");
    const normalized = texts.map(normalizeOne);

    // ------------------ Load page ------------------
    let page = await col.findOne({ pageId });

    if (!page) {
      await col.insertOne({
        pageId,
        sourceLang: "Hebrew",
        sourceTexts: normalized,
        translations: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      page = await col.findOne({ pageId });
    }

    // ------------------ Load translation cache ------------------
    const map = page.translations?.[targetLang] || {};

    // ------------------ Detect missing strings ------------------
    const missing = [];
    const seen = new Set();

    for (const t of normalized) {
      if (!t) continue;
      if (map[t]) continue;
      if (!seen.has(t)) {
        seen.add(t);
        missing.push(t);
      }
    }

    // ------------------ ✅ CACHE HIT (NO OpenAI) ------------------
    if (missing.length === 0) {
      const translatedTexts = normalized.map((t) => map[t] || t);


      return NextResponse.json(
        { translatedTexts },
        { headers: { "X-Translate-Cache": "HIT" } }
      );
    }


    const prompt = `
You are a translation engine.
Translate EACH item in this JSON array into ${targetLang}.
Return ONLY a JSON array of translated strings, same order (if you see חמודי  translate in arabic into : حمودي ).

${JSON.stringify(missing)}
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
    });

    const raw =
      completion.choices?.[0]?.message?.content?.trim() || "[]";

    const first = raw.indexOf("[");
    const last = raw.lastIndexOf("]");

    const translatedMissing = JSON.parse(raw.slice(first, last + 1));

    // ------------------ Update translation map ------------------
    for (let i = 0; i < missing.length; i++) {
      const src = missing[i];
      const tr = translatedMissing[i] || src;
      map[src] = tr;
    }

    await col.updateOne(
      { pageId },
      {
        $set: {
          [`translations.${targetLang}`]: map,
          sourceTexts: normalized, // snapshot only
          updatedAt: new Date(),
        },
      }
    );

    // ------------------ Build response aligned to DOM ------------------
    const translatedTexts = normalized.map((t) => map[t] || t);

    return NextResponse.json(
      { translatedTexts },
      { headers: { "X-Translate-Cache": "MISS" } }
    );
  } catch (err) {
    console.error("Translation error:", err);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}
