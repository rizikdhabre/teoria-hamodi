// lib/elevenlabs.js
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { generateGoogleTranslateTTS } from "./googleTranslateTTS";

let eleven = null;

function getElevenLabsClient() {
  if (!process.env.ELEVENLABS_API_KEY) {
    throw new Error("Missing ELEVENLABS_API_KEY");
  }

  if (!eleven) {
    eleven = new ElevenLabsClient({
      apiKey: process.env.ELEVENLABS_API_KEY,
    });
  }

  return eleven;
}

const voiceMap = {
  ar: "drMurExmkWVIH5nW8snR", 
  he: "EXAVITQu4vr4xnSDxMaL", 
  en: "JBFqnCBsd6RMkjVDRZzb", 
};

function logTtsError(provider, err, context = {}) {
  console.error(`${provider} TTS error:`, {
    provider,
    statusCode: err?.statusCode ?? null,
    message: err?.message,
    context: {
      ...context,
      ...(err?.context || {}),
    },
  });
}

/**

 * @param {string} text
 * @param {string} lang
 * @returns {Buffer}
 */
export async function generateTTS(text, lang = "en") {
  const normalizedLang = lang.toLowerCase();

  try {
    if (!text || typeof text !== "string") {
      throw new Error("Invalid text for TTS");
    }

    if (normalizedLang === "he") {
      return await generateGoogleTranslateTTS(text, normalizedLang);
    }

    const voiceId = voiceMap[normalizedLang] || voiceMap.en;

    const audioStream = await getElevenLabsClient().textToSpeech.convert(voiceId, {
      text,
      modelId: "eleven_multilingual_v2",
      outputFormat: "mp3_44100_128",
      voiceSettings: {
        stability: 0.5,
        similarityBoost: 0.7,
      },
    });

    const chunks = [];
    for await (const chunk of audioStream) {
      chunks.push(chunk);
    }

    return Buffer.concat(chunks);
  } catch (err) {
    logTtsError(normalizedLang === "he" ? "GoogleTranslate" : "ElevenLabs", err, {
      lang: normalizedLang,
      textLength: typeof text === "string" ? text.length : null,
    });
    throw err;
  }
}