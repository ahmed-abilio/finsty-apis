import { S3Client } from '@aws-sdk/client-s3';
import 'dotenv/config';

const { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION = 'us-east-1' } = process.env;

if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
  process.stderr.write('[S3] Warning: AWS credentials not set. S3 operations will fail.\n');
}

const s3Client = new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID ?? '',
    secretAccessKey: AWS_SECRET_ACCESS_KEY ?? '',
  },
});

export default s3Client;
