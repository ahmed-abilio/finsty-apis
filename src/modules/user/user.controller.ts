import { FastifyRequest, FastifyReply } from 'fastify';
import userService from './user.service';
import { extractS3KeyFromUrl } from '@utils/s3Uploader';
import { AppError } from '@utils/appError';

interface UpdateMeBody {
  name?: string;
  profileImage?: string;
}

interface ConfirmAvatarBody {
  profileImage: string;
}

class UserController {
  async getMe(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const user = await userService.findById(request.user.sub);
    void reply.status(200).send({ success: true, data: { user: user.toPublicJSON() } });
  }

  async updateMe(
    request: FastifyRequest<{ Body: UpdateMeBody }>,
    reply: FastifyReply,
  ): Promise<void> {
    const user = await userService.update(request.user.sub, request.body);
    void reply.status(200).send({ success: true, data: { user: user.toPublicJSON() } });
  }

  async deleteMe(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await userService.deactivate(request.user.sub);
    void reply.status(200).send({
      success: true,
      data: { message: 'Account deactivated successfully' },
    });
  }

  async confirmAvatarUpload(
    request: FastifyRequest<{ Body: ConfirmAvatarBody }>,
    reply: FastifyReply,
  ): Promise<void> {
    const { profileImage } = request.body;
    const userId = request.user.sub;

    // Extract the S3 key from the URL and verify it belongs to this user
    const key = extractS3KeyFromUrl(profileImage);
    if (!key) {
      throw AppError.badRequest('Invalid image URL — must be an S3 URL from this service', 'INVALID_IMAGE_URL');
    }

    // Key format: uploads/<folder>/<userId>/<timestamp>_<filename>
    const parts = key.split('/');
    if (parts.length < 4 || parts[0] !== 'uploads' || parts[2] !== userId) {
      throw AppError.badRequest('Image URL does not belong to this user', 'INVALID_IMAGE_URL');
    }

    const user = await userService.updateAvatar(userId, profileImage);
    void reply.status(200).send({ success: true, data: { user: user.toPublicJSON() } });
  }
}

export default new UserController();
