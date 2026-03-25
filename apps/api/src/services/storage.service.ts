import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Railway Buckets — S3-compatible object storage.
 *
 * Required env vars (auto-injected by Railway when a bucket is attached):
 *   ACCESS_KEY_ID, SECRET_ACCESS_KEY, BUCKET, ENDPOINT, REGION
 *
 * Buckets are private by default. All photo access uses presigned URLs;
 * there is no public base URL.
 */

function getClient(): S3Client {
  const accessKeyId = process.env.ACCESS_KEY_ID;
  const secretAccessKey = process.env.SECRET_ACCESS_KEY;
  const endpoint = process.env.ENDPOINT;
  const region = process.env.REGION ?? "auto";

  if (!accessKeyId || !secretAccessKey || !endpoint) {
    throw new Error("Storage is not configured (missing ACCESS_KEY_ID, SECRET_ACCESS_KEY, or ENDPOINT)");
  }

  return new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });
}

function getBucket(): string {
  const bucket = process.env.BUCKET;
  if (!bucket) throw new Error("BUCKET env var is not configured");
  return bucket;
}

export function isConfigured(): boolean {
  return !!(
    process.env.ACCESS_KEY_ID &&
    process.env.SECRET_ACCESS_KEY &&
    process.env.BUCKET &&
    process.env.ENDPOINT
  );
}

/**
 * Generate a presigned PUT URL for uploading a photo directly from a device.
 * Valid for 15 minutes.
 */
export async function createUploadUrl(
  key: string,
  contentType = "image/jpeg",
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: getBucket(),
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(getClient(), command, { expiresIn: 900 });
}

/**
 * Generate a presigned GET URL for reading a private photo.
 * Default expiry: 1 hour. Bump to 86400 (24h) for longer-lived links.
 */
export async function createDownloadUrl(
  key: string,
  expiresIn = 3600,
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: getBucket(),
    Key: key,
  });
  return getSignedUrl(getClient(), command, { expiresIn });
}

/**
 * Delete an object from storage. Best-effort — caller handles error logging.
 */
export async function deleteObject(key: string): Promise<void> {
  await getClient().send(
    new DeleteObjectCommand({ Bucket: getBucket(), Key: key }),
  );
}
