import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import s3Client from '@config/s3';
import { AppError } from '@utils/appError';

const BUCKET = process.env.S3_BUCKET_NAME ?? '';
const REGION = process.env.AWS_REGION ?? 'us-east-1';
const PRESIGNED_EXPIRES = parseInt(process.env.S3_PRESIGNED_URL_EXPIRES ?? '3600', 10);

/**
 * Upload a buffer directly to S3 and return the public URL.
 */
export async function uploadFile(
  buffer: Buffer,
  key: string,
  mimeType: string,
): Promise<string> {
  if (!BUCKET) throw AppError.internal('S3_BUCKET_NAME is not configured');

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
  });

  await s3Client.send(command);

  return `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;
}

/**
 * Generate a presigned URL for direct client-side upload.
 */
export async function getPresignedUploadUrl(
  key: string,
  mimeType: string,
  expiresIn = PRESIGNED_EXPIRES,
): Promise<string> {
  if (!BUCKET) throw AppError.internal('S3_BUCKET_NAME is not configured');

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: mimeType,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * Generate a presigned URL for reading a private S3 object.
 */
export async function getPresignedDownloadUrl(
  key: string,
  expiresIn = PRESIGNED_EXPIRES,
): Promise<string> {
  if (!BUCKET) throw AppError.internal('S3_BUCKET_NAME is not configured');

  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * Delete an object from S3.
 */
export async function deleteFile(key: string): Promise<void> {
  if (!BUCKET) throw AppError.internal('S3_BUCKET_NAME is not configured');

  await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

/**
 * Build a deterministic S3 key for user uploads.
 * e.g. uploads/avatars/abc-123/1700000000000_photo.jpg
 */
export function buildS3Key(
  folder: string,
  userId: string,
  filename: string,
): string {
  const timestamp = Date.now();
  const sanitized = filename.replace(/[^a-zA-Z0-9.\-_]/g, '_');
  return `${folder}/${userId}/${timestamp}_${sanitized}`;
}

/**
 * Build the public HTTPS URL for an S3 object by key.
 */
export function buildS3PublicUrl(key: string): string {
  if (!BUCKET) throw AppError.internal('S3_BUCKET_NAME is not configured');
  return `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;
}

/**
 * Extract the S3 object key from a full public S3 URL.
 * Returns null if the URL does not belong to the configured bucket.
 */
export function extractS3KeyFromUrl(url: string): string | null {
  console.log('url', url);
  if (!BUCKET) return null;
  const prefix = `https://${BUCKET}.s3.${REGION}.amazonaws.com/`;
  if (!url.startsWith(prefix)) return null;
  return url.slice(prefix.length);
}
