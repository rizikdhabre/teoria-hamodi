import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
const requiredEnv = [
  "R2_BUCKET",
  "R2_ENDPOINT",
  "R2_ACCESS_KEY",
  "R2_SECRET_KEY",
  "R2_PUBLIC_URL",
];

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing env variable: ${key}`);
  }
}
const r2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY,
    secretAccessKey: process.env.R2_SECRET_KEY,
  },
});

/**
 * Upload audio buffer to Cloudflare R2
 * @param {Buffer} buffer - audio buffer (mp3)
 * @param {string} fileName - file name (e.g. "123_ar_q.mp3")
 * @returns {string} public URL
 */
export async function uploadToR2(buffer, fileName) {
  try {
    const key = `audio/${fileName}`;

    await r2.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: "audio/mpeg",
        CacheControl: "public, max-age=31536000", // 1 year cache
      })
    );

    return `${process.env.R2_PUBLIC_URL}/${key}`;
  } catch (err) {
    console.error("R2 upload error:", err);
    throw err;
  }
}