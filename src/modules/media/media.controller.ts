import { FastifyRequest, FastifyReply } from 'fastify';
import { buildS3Key, buildS3PublicUrl, getPresignedUploadUrl, deleteFile } from '@utils/s3Uploader';
import { AppError } from '@utils/appError';
import { UploadFolder, getAllowedMimeTypes } from './media.schema';

interface PresignedUploadQuery {
  filename: string;
  mimeType: string;
  folder: UploadFolder;
}

interface DeleteMediaBody {
  key: string;
}

class MediaController {
  async getPresignedUpload(
    request: FastifyRequest<{ Querystring: PresignedUploadQuery }>,
    reply: FastifyReply,
  ): Promise<void> {
    const { filename, mimeType, folder } = request.query;
    const userId = request.user?.sub || 'public';

    // Validate mimeType is permitted for the selected folder
    const allowed = getAllowedMimeTypes(folder);
    if (!allowed.includes(mimeType)) {
      throw AppError.badRequest(
        `MIME type "${mimeType}" is not allowed in the "${folder}" folder. Allowed: ${allowed.join(', ')}`,
        'MIME_TYPE_NOT_ALLOWED_FOR_FOLDER',
      );
    }

    const key = buildS3Key(`uploads/${folder}`, userId, filename);
    const uploadUrl = await getPresignedUploadUrl(key, mimeType);
    const publicUrl = buildS3PublicUrl(key);

    void reply.status(200).send({ success: true, data: { uploadUrl, publicUrl, key } });
  }

  async deleteMedia(
    request: FastifyRequest<{ Body: DeleteMediaBody }>,
    reply: FastifyReply,
  ): Promise<void> {
    const { key } = request.body;
    const userId = request.user?.sub;

    // Key format: uploads/<folder>/<userId>/<timestamp>_<filename>
    const parts = key.split('/');
    if (parts.length < 4 || parts[0] !== 'uploads') {
      throw AppError.badRequest('Invalid key format', 'INVALID_S3_KEY');
    }

    // Only enforce userId check if the user is authenticated
    if (userId && parts[2] !== userId) {
      throw AppError.badRequest('Key does not belong to this user', 'UNAUTHORIZED_FOR_KEY');
    }

    await deleteFile(key);

    void reply.status(200).send({ success: true, data: { message: 'File deleted successfully' } });
  }
}

export default new MediaController();
