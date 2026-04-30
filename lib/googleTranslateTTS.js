import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

const GOOGLE_TRANSLATE_TTS_URL =
  "https://translate.google.com/translate_tts";
const GOOGLE_TRANSLATE_MAX_CHARS = 200;
const GOOGLE_TRANSLATE_MIN_FALLBACK_CHARS = 60;
const GOOGLE_TRANSLATE_MAX_RETRIES = 3;
const GOOGLE_TRANSLATE_TIMEOUT_MS = 10_000;
const GOOGLE_TRANSLATE_USER_AGENT = "Mozilla/5.0";
const RETRYABLE_STATUS_CODES = new Set([403, 408, 425, 429, 500, 502, 503, 504]);
const FFMPEG_BINARY_NAME = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
const require = createRequire(import.meta.url);

function buildFfmpegCandidatePaths() {
  const candidates = [];

  if (process.env.FFMPEG_PATH) {
    candidates.push(process.env.FFMPEG_PATH);
  }

  if (process.env.FFMPEG_BIN) {
    candidates.push(process.env.FFMPEG_BIN);
  }

  try {
    const packageJsonPath = require.resolve("ffmpeg-static/package.json");
    candidates.push(path.join(path.dirname(packageJsonPath), FFMPEG_BINARY_NAME));
  } catch {
    // Keep searching other known locations if package resolution is unavailable.
  }

  candidates.push(
    path.join(process.cwd(), "node_modules", "ffmpeg-static", FFMPEG_BINARY_NAME)
  );
  candidates.push(
    path.join(
      process.cwd(),
      ".next",
      "standalone",
      "node_modules",
      "ffmpeg-static",
      FFMPEG_BINARY_NAME
    )
  );

  return [...new Set(candidates.filter(Boolean))];
}

async function resolveFfmpegBinaryPath(context = {}) {
  const candidatePaths = buildFfmpegCandidatePaths();

  for (const candidatePath of candidatePaths) {
    try {
      await fs.access(candidatePath);
      return candidatePath;
    } catch {
      // Continue checking other candidate locations.
    }
  }

  throw createGoogleTranslateError("ffmpeg binary is not available", {
    context: {
      ...context,
      candidatePaths,
    },
  });
}

function createGoogleTranslateError(message, details = {}) {
  const error = new Error(message);
  error.provider = "GoogleTranslate";
  error.statusCode = details.statusCode ?? null;
  error.retryable = details.retryable ?? false;
  error.context = details.context ?? {};
  error.cause = details.cause;
  return error;
}

function logGoogleTranslateWarning(error, context = {}) {
  console.warn("GoogleTranslate TTS warning:", {
    provider: "GoogleTranslate",
    statusCode: error?.statusCode ?? null,
    message: error?.message,
    context,
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryDelayMs(attempt) {
  return Math.min(500 * 2 ** attempt, 4_000);
}

function normalizeText(text) {
  return text.replace(/\s+/g, " ").trim();
}

function shouldRetryStatus(statusCode) {
  return RETRYABLE_STATUS_CODES.has(statusCode);
}

function parseDurationToSeconds(stderr) {
  const match = stderr.match(/Duration:\s+(\d+):(\d+):(\d+(?:\.\d+)?)/);

  if (!match) {
    return null;
  }

  const [, hours, minutes, seconds] = match;
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

function escapeConcatFilePath(filePath) {
  return filePath.replace(/\\/g, "/").replace(/'/g, "'\\''");
}

function splitTextIntoChunks(text, maxChars = GOOGLE_TRANSLATE_MAX_CHARS) {
  const normalizedText = normalizeText(text);

  if (!normalizedText) {
    return [];
  }

  const words = normalizedText.split(" ");
  const chunks = [];
  let currentChunk = "";

  for (const word of words) {
    if (word.length > maxChars) {
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = "";
      }

      for (let index = 0; index < word.length; index += maxChars) {
        chunks.push(word.slice(index, index + maxChars));
      }

      continue;
    }

    const nextChunk = currentChunk ? `${currentChunk} ${word}` : word;

    if (nextChunk.length <= maxChars) {
      currentChunk = nextChunk;
      continue;
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    currentChunk = word;
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

async function runFfmpeg(args, context = {}) {
  // Next server bundling can rewrite asset imports into .next vendor chunks.
  // Resolve the ffmpeg binary from the installed package at runtime instead.
  const ffmpegBinaryPath = await resolveFfmpegBinaryPath(context);

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(ffmpegBinaryPath, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    ffmpeg.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    ffmpeg.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    ffmpeg.on("error", (error) => {
      reject(
        createGoogleTranslateError("ffmpeg process failed to start", {
          context: {
            ...context,
            ffmpegBinaryPath,
          },
          cause: error,
        })
      );
    });

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(
        createGoogleTranslateError(`ffmpeg exited with code ${code}`, {
          context: {
            ...context,
            ffmpegBinaryPath,
            ffmpegArgs: args,
          },
        })
      );
    });
  });
}

async function validateMp3File(filePath, context = {}) {
  const { stderr } = await runFfmpeg(
    ["-hide_banner", "-nostats", "-i", filePath, "-f", "null", "-"],
    context
  );
  const durationSeconds = parseDurationToSeconds(stderr);

  if (!durationSeconds || durationSeconds <= 0) {
    throw createGoogleTranslateError("Merged Hebrew MP3 duration is invalid", {
      context: {
        ...context,
        durationSeconds,
      },
    });
  }

  return durationSeconds;
}

async function mergeMp3Buffers(buffers, context = {}) {
  if (!Array.isArray(buffers) || buffers.length === 0) {
    throw createGoogleTranslateError("No MP3 buffers were produced for Hebrew TTS", {
      context,
    });
  }

  if (buffers.length === 1) {
    return validateFinalMp3Buffer(buffers[0], context);
  }

  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), `hebrew-tts-${randomUUID()}-`)
  );
  const chunkFiles = [];

  try {
    for (const [index, buffer] of buffers.entries()) {
      const chunkFile = path.join(tempDir, `chunk-${index}.mp3`);
      await fs.writeFile(chunkFile, buffer);
      chunkFiles.push(chunkFile);
    }

    const concatFile = path.join(tempDir, "concat.txt");
    const concatContents = chunkFiles
      .map((filePath) => `file '${escapeConcatFilePath(filePath)}'`)
      .join("\n");
    const outputFile = path.join(tempDir, "merged.mp3");

    await fs.writeFile(concatFile, concatContents);

    // Re-encode the stitched chunks so the final output is one valid MP3 file.
    await runFfmpeg(
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        concatFile,
        "-vn",
        "-c:a",
        "libmp3lame",
        "-b:a",
        "128k",
        outputFile,
      ],
      context
    );

    await validateMp3File(outputFile, context);

    return await fs.readFile(outputFile);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function validateFinalMp3Buffer(buffer, context = {}) {
  if (!buffer?.length) {
    throw createGoogleTranslateError("Hebrew TTS returned empty audio", {
      context,
    });
  }

  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), `hebrew-tts-validate-${randomUUID()}-`)
  );
  const filePath = path.join(tempDir, "candidate.mp3");

  try {
    await fs.writeFile(filePath, buffer);
    await validateMp3File(filePath, context);
    return buffer;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function fetchGoogleTranslateChunk(text, lang, context = {}) {
  const url =
    `${GOOGLE_TRANSLATE_TTS_URL}?ie=UTF-8&q=${encodeURIComponent(text)}` +
    `&tl=${lang}&client=tw-ob`;

  for (let attempt = 0; attempt <= GOOGLE_TRANSLATE_MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GOOGLE_TRANSLATE_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": GOOGLE_TRANSLATE_USER_AGENT,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorBody = "";

        try {
          errorBody = await response.text();
        } catch {
          errorBody = "";
        }

        const error = createGoogleTranslateError(
          `Google Translate TTS request failed (${response.status})${
            errorBody ? `: ${errorBody}` : ""
          }`,
          {
            statusCode: response.status,
            retryable: shouldRetryStatus(response.status),
            context: {
              ...context,
              url,
              textLength: text.length,
              attempt: attempt + 1,
            },
          }
        );

        if (error.retryable && attempt < GOOGLE_TRANSLATE_MAX_RETRIES) {
          logGoogleTranslateWarning(error, error.context);
          await sleep(getRetryDelayMs(attempt));
          continue;
        }

        throw error;
      }

      const audioBuffer = Buffer.from(await response.arrayBuffer());

      if (!audioBuffer.length) {
        throw createGoogleTranslateError(
          "Google Translate TTS returned empty audio",
          {
            context: {
              ...context,
              textLength: text.length,
              attempt: attempt + 1,
            },
          }
        );
      }

      return audioBuffer;
    } catch (error) {
      clearTimeout(timeoutId);

      const isAbortError = error?.name === "AbortError";
      const normalizedError =
        error?.provider === "GoogleTranslate"
          ? error
          : createGoogleTranslateError(
              isAbortError
                ? "Google Translate TTS request timed out"
                : "Google Translate TTS request failed",
              {
                retryable: isAbortError,
                context: {
                  ...context,
                  textLength: text.length,
                  attempt: attempt + 1,
                },
                cause: error,
              }
            );

      if (normalizedError.retryable && attempt < GOOGLE_TRANSLATE_MAX_RETRIES) {
        logGoogleTranslateWarning(normalizedError, normalizedError.context);
        await sleep(getRetryDelayMs(attempt));
        continue;
      }

      throw normalizedError;
    }
  }

  throw createGoogleTranslateError("Google Translate TTS exhausted all retries", {
    context,
  });
}

async function generateChunkAudioBuffers(text, lang, maxChars, context = {}) {
  const chunks = splitTextIntoChunks(text, maxChars);

  if (chunks.length === 0) {
    throw createGoogleTranslateError("Invalid text for Google Translate TTS", {
      context,
    });
  }

  const audioBuffers = [];

  for (const [chunkIndex, chunk] of chunks.entries()) {
    try {
      const audioBuffer = await fetchGoogleTranslateChunk(chunk, lang, {
        ...context,
        chunkIndex,
        totalChunks: chunks.length,
      });
      audioBuffers.push(audioBuffer);
    } catch (error) {
      const shouldFallbackToSmallerChunks =
        error?.retryable && chunk.length > GOOGLE_TRANSLATE_MIN_FALLBACK_CHARS;

      if (!shouldFallbackToSmallerChunks) {
        throw error;
      }

      const nextMaxChars = Math.max(
        GOOGLE_TRANSLATE_MIN_FALLBACK_CHARS,
        Math.floor(chunk.length / 2)
      );

      if (nextMaxChars >= chunk.length) {
        throw error;
      }

      logGoogleTranslateWarning(error, {
        ...error.context,
        fallbackChunkSize: nextMaxChars,
      });

      const fallbackBuffers = await generateChunkAudioBuffers(chunk, lang, nextMaxChars, {
        ...context,
        parentChunkIndex: chunkIndex,
      });
      audioBuffers.push(...fallbackBuffers);
    }
  }

  return audioBuffers;
}

/**
 * @param {string} text
 * @param {string} lang
 * @returns {Promise<Buffer>}
 */
export async function generateGoogleTranslateTTS(text, lang = "he") {
  if (!text || typeof text !== "string") {
    throw createGoogleTranslateError("Invalid text for Google Translate TTS", {
      context: {
        lang,
      },
    });
  }

  const normalizedText = normalizeText(text);
  const context = {
    lang,
    textLength: normalizedText.length,
  };

  if (!normalizedText) {
    throw createGoogleTranslateError("Invalid text for Google Translate TTS", {
      context,
    });
  }

  const audioBuffers = await generateChunkAudioBuffers(
    normalizedText,
    lang,
    GOOGLE_TRANSLATE_MAX_CHARS,
    context
  );

  const mergedBuffer = await mergeMp3Buffers(audioBuffers, context);
  return validateFinalMp3Buffer(mergedBuffer, context);
}