// lib/elevenlabs.js
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

//  Validate env
if (!process.env.ELEVENLABS_API_KEY) {
  throw new Error("Missing ELEVENLABS_API_KEY");
}

const eleven = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});

const voiceMap = {
  ar: "drMurExmkWVIH5nW8snR", 
  he: "EXAVITQu4vr4xnSDxMaL", 
  en: "JBFqnCBsd6RMkjVDRZzb", 
};

/**

 * @param {string} text
 * @param {string} lang
 * @returns {Buffer}
 */
export async function generateTTS(text, lang = "en") {
  try {
    if (!text || typeof text !== "string") {
      throw new Error("Invalid text for TTS");
    }

    const voiceId = voiceMap[lang] || voiceMap.en;

    const audioStream = await eleven.textToSpeech.convert(voiceId, {
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
    console.error("ElevenLabs TTS error:", err);
    throw err;
  }
}