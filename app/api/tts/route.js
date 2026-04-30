import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getCollection, toObjectId } from "@/lib/db";
import { generateTTS } from "@/lib/elevenlabs";
import { uploadToR2 } from "@/lib/r2";
import { getAudioProfileVersion, getCurrentAudioEntry } from "@/lib/ttsProfile";

const pendingTtsBundleJobs = new Map();
const LOCK_TTL_MS = 30 * 1000;
const LOCK_HEARTBEAT_MS = 10 * 1000;
const LOCK_POLL_INITIAL_MS = 100;
const LOCK_POLL_MAX_MS = 1000;
const LOCK_WAIT_TIMEOUT_MS = 90 * 1000;
const LONG_OPERATION_LEASE_MS = 2 * 60 * 1000;

if (LOCK_HEARTBEAT_MS >= LOCK_TTL_MS) {
  throw new Error("LOCK_HEARTBEAT_MS must be shorter than LOCK_TTL_MS");
}

if (LONG_OPERATION_LEASE_MS < LOCK_TTL_MS) {
  throw new Error(
    "LONG_OPERATION_LEASE_MS must be at least LOCK_TTL_MS"
  );
}

function buildBundleJobKey({ collectionName, docId, lang }) {
  return [collectionName, docId, lang].join(":");
}

function buildLockPath(lang) {
  return `ttsLocks.${lang}`;
}

function buildLockOwnerPath(lang) {
  return `${buildLockPath(lang)}.owner`;
}

function buildLockExpiresAtPath(lang) {
  return `${buildLockPath(lang)}.expiresAt`;
}

function buildLostLockError(objectId, lang) {
  return new Error(
    `Lost TTS generation lock for ${objectId.toString()} (${lang})`
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getNextPollDelayMs(delayMs) {
  return Math.min(delayMs * 2, LOCK_POLL_MAX_MS);
}

function getRemainingWaitMs(startedAt) {
  return LOCK_WAIT_TIMEOUT_MS - (Date.now() - startedAt);
}

function hasWaitTimedOut(startedAt) {
  return getRemainingWaitMs(startedAt) <= 0;
}

function buildLockTimeoutResponse() {
  return NextResponse.json(
    {
      error: "TTS generation is taking longer than expected. Please retry.",
      code: "tts_generation_timeout",
    },
    {
      status: 503,
      headers: {
        "Retry-After": "1",
      },
    }
  );
}

function getExistingAudioUrl(doc, lang, type, optionKey) {
  const currentAudio = getCurrentAudioEntry(doc, lang);

  if (!currentAudio) {
    return null;
  }

  if (type === "question") {
    return currentAudio.question || null;
  }

  return currentAudio.options?.[optionKey] || null;
}

async function runPendingBundleJob(jobKey, createJob) {
  const job = createJob().finally(() => {
    if (pendingTtsBundleJobs.get(jobKey) === job) {
      pendingTtsBundleJobs.delete(jobKey);
    }
  });

  pendingTtsBundleJobs.set(jobKey, job);
  return job;
}

async function waitForPendingJob(pendingJob, startedAt) {
  const remainingMs = getRemainingWaitMs(startedAt);

  if (remainingMs <= 0) {
    return false;
  }

  const result = await Promise.race([
    pendingJob.then(() => true),
    sleep(remainingMs).then(() => false),
  ]);

  return result;
}

async function sleepWithBackoff(delayMs, startedAt) {
  const remainingMs = getRemainingWaitMs(startedAt);

  if (remainingMs <= 0) {
    return false;
  }

  await sleep(Math.min(delayMs, remainingMs));
  return true;
}

async function tryAcquireMongoLock({ collection, objectId, lang, owner }) {
  const now = new Date();
  const lockPath = buildLockPath(lang);
  const expiresAtPath = buildLockExpiresAtPath(lang);
  const result = await collection.updateOne(
    {
      _id: objectId,
      $or: [
        { [lockPath]: { $exists: false } },
        { [expiresAtPath]: { $lte: now } },
      ],
    },
    {
      $set: {
        [lockPath]: {
          owner,
          expiresAt: new Date(now.getTime() + LOCK_TTL_MS),
        },
      },
    }
  );

  return result.modifiedCount === 1;
}

async function refreshMongoLock({
  collection,
  objectId,
  lang,
  owner,
  leaseMs = LOCK_TTL_MS,
}) {
  const result = await collection.updateOne(
    {
      _id: objectId,
      [buildLockOwnerPath(lang)]: owner,
    },
    {
      $set: {
        [buildLockExpiresAtPath(lang)]: new Date(Date.now() + leaseMs),
      },
    }
  );

  return result.modifiedCount === 1;
}

async function updateWhileLockOwner({
  collection,
  objectId,
  lang,
  owner,
  update,
}) {
  const result = await collection.updateOne(
    {
      _id: objectId,
      [buildLockOwnerPath(lang)]: owner,
    },
    update
  );

  if (result.matchedCount !== 1) {
    throw buildLostLockError(objectId, lang);
  }

  return result;
}

async function releaseMongoLock({ collection, objectId, lang, owner }) {
  await collection.updateOne(
    {
      _id: objectId,
      [buildLockOwnerPath(lang)]: owner,
    },
    {
      $unset: {
        [buildLockPath(lang)]: "",
      },
    }
  );
}

async function withMongoLockHeartbeat({
  collection,
  objectId,
  lang,
  owner,
  task,
}) {
  let heartbeatTimeout = null;
  let heartbeatError = null;
  let heartbeatPromise = Promise.resolve();

  const scheduleHeartbeat = () => {
    heartbeatTimeout = setTimeout(runHeartbeat, LOCK_HEARTBEAT_MS);
  };

  const runHeartbeat = () => {
    heartbeatPromise = refreshMongoLock({
      collection,
      objectId,
      lang,
      owner,
    })
      .then((didRefresh) => {
        if (!didRefresh) {
          heartbeatError = buildLostLockError(objectId, lang);
          return;
        }

        scheduleHeartbeat();
      })
      .catch((error) => {
        heartbeatError = error;
      });
  };

  const assertLockHealthy = () => {
    if (heartbeatError) {
      throw heartbeatError;
    }
  };

  const runWhileLocked = async (operation, options = {}) => {
    assertLockHealthy();

    if (options.leaseMs) {
      const didRefresh = await refreshMongoLock({
        collection,
        objectId,
        lang,
        owner,
        leaseMs: options.leaseMs,
      });

      if (!didRefresh) {
        heartbeatError = buildLostLockError(objectId, lang);
        assertLockHealthy();
      }
    }

    const result = await operation();
    assertLockHealthy();
    return result;
  };

  scheduleHeartbeat();

  try {
    return await task(runWhileLocked);
  } finally {
    if (heartbeatTimeout) {
      clearTimeout(heartbeatTimeout);
    }

    await heartbeatPromise.catch(() => {});

    await releaseMongoLock({
      collection,
      objectId,
      lang,
      owner,
    });
  }
}

async function generateAndUploadAudio({ docId, lang, text, type, optionKey }) {
  const buffer = await generateTTS(text, lang);
  const fileName = `${docId}_${lang}_${type}_${optionKey || "q"}.mp3`;

  return uploadToR2(buffer, fileName);
}

export async function POST(req) {
  try {
    const body = await req.json();

    const {
      collectionName,
      docId,
      lang,
      type,
      optionKey,
      includeOptions = false,
    } = body;

    if (!collectionName || !docId || !lang || !type) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const collection = await getCollection(collectionName);
    const objectId = toObjectId(docId);

    const doc = await collection.findOne({
      _id: objectId,
    });

    if (!doc) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }
    const resolvedLang = doc.translations?.[lang] ? lang : "he";
    const translation = doc.translations?.[resolvedLang];
    const audioProfileVersion = getAudioProfileVersion(resolvedLang);
    const bundleJobKey = buildBundleJobKey({
      collectionName,
      docId,
      lang: resolvedLang,
    });
    if (!translation) {
      return NextResponse.json(
        { error: "Language not found" },
        { status: 400 }
      );
    }

    if (includeOptions) {
      if (type !== "question") {
        return NextResponse.json(
          { error: "includeOptions is only supported for question type" },
          { status: 400 }
        );
      }

      const optionEntries = Object.entries(translation.options || {});
      const waitStartedAt = Date.now();
      let pollDelayMs = LOCK_POLL_INITIAL_MS;

      while (true) {
        if (hasWaitTimedOut(waitStartedAt)) {
          return buildLockTimeoutResponse();
        }

        const currentDoc = await collection.findOne({ _id: objectId });
        const currentAudio = getCurrentAudioEntry(currentDoc, resolvedLang);
        const currentQuestionUrl = currentAudio?.question || null;
        const currentOptionUrls = {
          ...(currentAudio?.options || {}),
        };
        const hasAllOptions = optionEntries.every(
          ([key]) => currentOptionUrls[key]
        );

        if (currentQuestionUrl && hasAllOptions) {
          return NextResponse.json({
            url: currentQuestionUrl,
            questionUrl: currentQuestionUrl,
            optionUrls: currentOptionUrls,
          });
        }

        const pendingJob = pendingTtsBundleJobs.get(bundleJobKey);
        if (pendingJob) {
          const didFinish = await waitForPendingJob(pendingJob, waitStartedAt);

          if (!didFinish) {
            return buildLockTimeoutResponse();
          }

          pollDelayMs = LOCK_POLL_INITIAL_MS;

          continue;
        }

        const lockOwner = randomUUID();
        const hasMongoLock = await tryAcquireMongoLock({
          collection,
          objectId,
          lang: resolvedLang,
          owner: lockOwner,
        });

        if (!hasMongoLock) {
          const didSleep = await sleepWithBackoff(pollDelayMs, waitStartedAt);

          if (!didSleep) {
            return buildLockTimeoutResponse();
          }

          pollDelayMs = getNextPollDelayMs(pollDelayMs);
          continue;
        }

        pollDelayMs = LOCK_POLL_INITIAL_MS;

        const result = await runPendingBundleJob(bundleJobKey, async () => {
          return withMongoLockHeartbeat({
            collection,
            objectId,
            lang: resolvedLang,
            owner: lockOwner,
            task: async (runWhileLocked) => {
              const freshDoc = await runWhileLocked(() =>
                collection.findOne({ _id: objectId })
              );
              const freshTranslation = freshDoc?.translations?.[resolvedLang];

              if (!freshTranslation) {
                throw new Error("Language not found during TTS generation");
              }

              const nextOptionEntries = Object.entries(
                freshTranslation.options || {}
              );
              const currentAudio = getCurrentAudioEntry(freshDoc, resolvedLang);
              const nextOptionUrls = {
                ...(currentAudio?.options || {}),
              };
              let nextQuestionUrl = currentAudio?.question || null;
              const audioUpdates = {};

              if (!nextQuestionUrl) {
                nextQuestionUrl = await runWhileLocked(() =>
                  generateAndUploadAudio({
                    docId,
                    lang: resolvedLang,
                    text: freshTranslation.question,
                    type: "question",
                  }),
                  { leaseMs: LONG_OPERATION_LEASE_MS }
                );
                audioUpdates[`audio.${resolvedLang}.question`] = nextQuestionUrl;
              }

              for (const [key, option] of nextOptionEntries) {
                if (nextOptionUrls[key]) {
                  continue;
                }

                const optionUrl = await runWhileLocked(() =>
                  generateAndUploadAudio({
                    docId,
                    lang: resolvedLang,
                    text: option.text,
                    type: "option",
                    optionKey: key,
                  }),
                  { leaseMs: LONG_OPERATION_LEASE_MS }
                );

                nextOptionUrls[key] = optionUrl;
                audioUpdates[`audio.${resolvedLang}.options.${key}`] = optionUrl;
              }

              if (Object.keys(audioUpdates).length > 0) {
                if (audioProfileVersion) {
                  audioUpdates[`audioMeta.${resolvedLang}.profileVersion`] =
                    audioProfileVersion;
                }

                await runWhileLocked(() =>
                  updateWhileLockOwner({
                    collection,
                    objectId,
                    lang: resolvedLang,
                    owner: lockOwner,
                    update: {
                      $set: audioUpdates,
                    },
                  })
                );
              }

              return {
                questionUrl: nextQuestionUrl,
                optionUrls: nextOptionUrls,
              };
            },
          });
        });

        return NextResponse.json({
          url: result.questionUrl,
          questionUrl: result.questionUrl,
          optionUrls: result.optionUrls,
        });
      }
    }

    let text;
    if (type === "question") {
      text = translation.question;
    } else if (type === "option") {
      if (!optionKey || !translation.options?.[optionKey]) {
        return NextResponse.json(
          { error: "Invalid optionKey" },
          { status: 400 }
        );
      }
      text = translation.options[optionKey].text;
    } else {
      return NextResponse.json(
        { error: "Invalid type" },
        { status: 400 }
      );
    }

    const waitStartedAt = Date.now();
    let pollDelayMs = LOCK_POLL_INITIAL_MS;

    while (true) {
      if (hasWaitTimedOut(waitStartedAt)) {
        return buildLockTimeoutResponse();
      }

      const currentDoc = await collection.findOne({ _id: objectId });
      const existing = getExistingAudioUrl(
        currentDoc,
        resolvedLang,
        type,
        optionKey
      );

      if (existing) {
        return NextResponse.json({ url: existing });
      }

      const pendingJob = pendingTtsBundleJobs.get(bundleJobKey);
      if (pendingJob) {
        const didFinish = await waitForPendingJob(pendingJob, waitStartedAt);

        if (!didFinish) {
          return buildLockTimeoutResponse();
        }

        pollDelayMs = LOCK_POLL_INITIAL_MS;

        continue;
      }

      const lockOwner = randomUUID();
      const hasMongoLock = await tryAcquireMongoLock({
        collection,
        objectId,
        lang: resolvedLang,
        owner: lockOwner,
      });

      if (!hasMongoLock) {
        const didSleep = await sleepWithBackoff(pollDelayMs, waitStartedAt);

        if (!didSleep) {
          return buildLockTimeoutResponse();
        }

        pollDelayMs = getNextPollDelayMs(pollDelayMs);
        continue;
      }

      pollDelayMs = LOCK_POLL_INITIAL_MS;

      const url = await runPendingBundleJob(bundleJobKey, async () => {
        return withMongoLockHeartbeat({
          collection,
          objectId,
          lang: resolvedLang,
          owner: lockOwner,
          task: async (runWhileLocked) => {
            const freshDoc = await runWhileLocked(() =>
              collection.findOne({ _id: objectId })
            );
            const existingAfterWait = getExistingAudioUrl(
              freshDoc,
              resolvedLang,
              type,
              optionKey
            );

            if (existingAfterWait) {
              return existingAfterWait;
            }

            const freshTranslation = freshDoc?.translations?.[resolvedLang];
            if (!freshTranslation) {
              throw new Error("Language not found during TTS generation");
            }

            const nextText =
              type === "question"
                ? freshTranslation.question
                : freshTranslation.options?.[optionKey]?.text;

            if (!nextText) {
              throw new Error("Missing text during TTS generation");
            }

            const generatedUrl = await runWhileLocked(() =>
              generateAndUploadAudio({
                docId,
                lang: resolvedLang,
                text: nextText,
                type,
                optionKey,
              }),
              { leaseMs: LONG_OPERATION_LEASE_MS }
            );

            const updatePath =
              type === "question"
                ? `audio.${resolvedLang}.question`
                : `audio.${resolvedLang}.options.${optionKey}`;

            await runWhileLocked(() =>
              updateWhileLockOwner({
                collection,
                objectId,
                lang: resolvedLang,
                owner: lockOwner,
                update: {
                  $set: {
                    [updatePath]: generatedUrl,
                    ...(audioProfileVersion
                      ? {
                          [`audioMeta.${resolvedLang}.profileVersion`]:
                            audioProfileVersion,
                        }
                      : {}),
                  },
                },
              })
            );

            return generatedUrl;
          },
        });
      });

      return NextResponse.json({ url });
    }

  } catch (err) {
    console.error("TTS Route Error:", err);

    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}