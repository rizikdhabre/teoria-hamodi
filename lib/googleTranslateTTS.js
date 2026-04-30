const GOOGLE_TRANSLATE_TTS_URL =
  "https://translate.google.com/translate_tts";
const GOOGLE_TRANSLATE_MAX_CHARS = 200;
const GOOGLE_TRANSLATE_MIN_FALLBACK_CHARS = 60;
const GOOGLE_TRANSLATE_MAX_RETRIES = 3;
const GOOGLE_TRANSLATE_TIMEOUT_MS = 10_000;
const GOOGLE_TRANSLATE_USER_AGENT = "Mozilla/5.0";
const RETRYABLE_STATUS_CODES = new Set([403, 408, 425, 429, 500, 502, 503, 504]);
const MPEG_VERSION_MAP = {
  0b00: "2.5",
  0b10: "2",
  0b11: "1",
};
const MPEG_LAYER_MAP = {
  0b01: "3",
  0b10: "2",
  0b11: "1",
};
const CHANNEL_MODE_MAP = {
  0b00: "stereo",
  0b01: "joint-stereo",
  0b10: "dual-channel",
  0b11: "mono",
};
const BITRATE_TABLE = {
  "1:1": [32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448],
  "1:2": [32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384],
  "1:3": [32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
  "2:1": [32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
  "2:2": [8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
  "2:3": [8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
  "2.5:1": [32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
  "2.5:2": [8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
  "2.5:3": [8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
};
const SAMPLE_RATE_TABLE = {
  "1": [44100, 48000, 32000],
  "2": [22050, 24000, 16000],
  "2.5": [11025, 12000, 8000],
};
const SAMPLES_PER_FRAME_TABLE = {
  "1:1": 384,
  "1:2": 1152,
  "1:3": 1152,
  "2:1": 384,
  "2:2": 1152,
  "2:3": 576,
  "2.5:1": 384,
  "2.5:2": 1152,
  "2.5:3": 576,
};

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

function getBitrate(version, layer, bitrateIndex) {
  return BITRATE_TABLE[`${version}:${layer}`]?.[bitrateIndex - 1] ?? null;
}

function getSampleRate(version, sampleRateIndex) {
  return SAMPLE_RATE_TABLE[version]?.[sampleRateIndex] ?? null;
}

function getSamplesPerFrame(version, layer) {
  return SAMPLES_PER_FRAME_TABLE[`${version}:${layer}`] ?? null;
}

function parseMp3FrameHeader(buffer, offset = 0) {
  if (offset + 4 > buffer.length) {
    return null;
  }

  const byte1 = buffer[offset];
  const byte2 = buffer[offset + 1];
  const byte3 = buffer[offset + 2];
  const byte4 = buffer[offset + 3];

  if (byte1 !== 0xff || (byte2 & 0xe0) !== 0xe0) {
    return null;
  }

  const versionBits = (byte2 >> 3) & 0x03;
  const layerBits = (byte2 >> 1) & 0x03;
  const bitrateIndex = (byte3 >> 4) & 0x0f;
  const sampleRateIndex = (byte3 >> 2) & 0x03;
  const paddingBit = (byte3 >> 1) & 0x01;
  const channelModeBits = (byte4 >> 6) & 0x03;

  const version = MPEG_VERSION_MAP[versionBits] ?? null;
  const layer = MPEG_LAYER_MAP[layerBits] ?? null;

  if (
    !version ||
    !layer ||
    bitrateIndex === 0 ||
    bitrateIndex === 0x0f ||
    sampleRateIndex === 0x03
  ) {
    return null;
  }

  const bitrate = getBitrate(version, layer, bitrateIndex);
  const sampleRate = getSampleRate(version, sampleRateIndex);
  const samplesPerFrame = getSamplesPerFrame(version, layer);

  if (!bitrate || !sampleRate || !samplesPerFrame) {
    return null;
  }

  let frameLength;
  if (layer === "1") {
    frameLength = Math.floor(((12 * bitrate * 1000) / sampleRate + paddingBit) * 4);
  } else {
    const coefficient = version === "1" || layer === "2" ? 144 : 72;
    frameLength = Math.floor((coefficient * bitrate * 1000) / sampleRate + paddingBit);
  }

  if (!Number.isFinite(frameLength) || frameLength <= 0) {
    return null;
  }

  return {
    version,
    layer,
    bitrate,
    sampleRate,
    samplesPerFrame,
    frameLength,
    channelMode: CHANNEL_MODE_MAP[channelModeBits] ?? "unknown",
  };
}

function buildFrameSignature(header) {
  return [header.version, header.layer, header.sampleRate, header.channelMode].join(":");
}

function findFirstMp3FrameOffset(buffer) {
  for (let offset = 0; offset <= buffer.length - 4; offset += 1) {
    const header = parseMp3FrameHeader(buffer, offset);

    if (!header) {
      continue;
    }

    const nextOffset = offset + header.frameLength;
    if (nextOffset === buffer.length) {
      return offset;
    }

    if (nextOffset + 4 <= buffer.length && parseMp3FrameHeader(buffer, nextOffset)) {
      return offset;
    }
  }

  return -1;
}

function analyzeMp3Buffer(buffer, context = {}) {
  if (!buffer?.length) {
    throw createGoogleTranslateError("Hebrew TTS returned empty audio", {
      context,
    });
  }

  const firstFrameOffset = findFirstMp3FrameOffset(buffer);
  if (firstFrameOffset < 0) {
    throw createGoogleTranslateError("Hebrew MP3 stream does not contain a valid frame", {
      context,
    });
  }

  const audioBuffer = buffer.subarray(firstFrameOffset);
  let offset = 0;
  let frameCount = 0;
  let totalSamples = 0;
  let expectedSignature = null;
  let firstHeader = null;

  while (offset < audioBuffer.length) {
    const header = parseMp3FrameHeader(audioBuffer, offset);

    if (!header || offset + header.frameLength > audioBuffer.length) {
      throw createGoogleTranslateError("Hebrew MP3 stream contains an invalid frame sequence", {
        context: {
          ...context,
          offset,
          frameCount,
        },
      });
    }

    if (!firstHeader) {
      firstHeader = header;
      expectedSignature = buildFrameSignature(header);
    } else if (buildFrameSignature(header) !== expectedSignature) {
      throw createGoogleTranslateError("Hebrew MP3 stream format changes mid-file", {
        context: {
          ...context,
          offset,
          frameCount,
          expectedSignature,
          actualSignature: buildFrameSignature(header),
        },
      });
    }

    totalSamples += header.samplesPerFrame;
    frameCount += 1;
    offset += header.frameLength;
  }

  if (!firstHeader || frameCount === 0) {
    throw createGoogleTranslateError("Hebrew MP3 stream does not contain playable audio", {
      context,
    });
  }

  const durationSeconds = totalSamples / firstHeader.sampleRate;
  if (!durationSeconds || durationSeconds <= 0) {
    throw createGoogleTranslateError("Merged Hebrew MP3 duration is invalid", {
      context: {
        ...context,
        durationSeconds,
      },
    });
  }

  return {
    audioBuffer,
    frameCount,
    durationSeconds,
    streamSignature: expectedSignature,
  };
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

async function mergeMp3Buffers(buffers, context = {}) {
  if (!Array.isArray(buffers) || buffers.length === 0) {
    throw createGoogleTranslateError("No MP3 buffers were produced for Hebrew TTS", {
      context,
    });
  }

  if (buffers.length === 1) {
    return validateFinalMp3Buffer(buffers[0], context);
  }
  const analyzedStreams = buffers.map((buffer, chunkIndex) =>
    analyzeMp3Buffer(buffer, {
      ...context,
      chunkIndex,
    })
  );
  const [firstStream, ...otherStreams] = analyzedStreams;

  for (const stream of otherStreams) {
    if (stream.streamSignature !== firstStream.streamSignature) {
      throw createGoogleTranslateError("Hebrew MP3 chunks have incompatible formats", {
        context: {
          ...context,
          expectedSignature: firstStream.streamSignature,
          actualSignature: stream.streamSignature,
        },
      });
    }
  }

  // Google Translate returns raw MP3 frame streams, so after validating
  // compatible frame headers we can concatenate the frame data directly.
  const mergedBuffer = Buffer.concat(
    analyzedStreams.map((stream) => stream.audioBuffer)
  );

  return validateFinalMp3Buffer(mergedBuffer, context);
}

async function validateFinalMp3Buffer(buffer, context = {}) {
  analyzeMp3Buffer(buffer, context);
  return buffer;
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