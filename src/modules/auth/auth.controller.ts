import { FastifyRequest, FastifyReply } from 'fastify';
import * as authService from './auth.service';
import userService from '../user/user.service';
import storeService from '../store/store.service';
import { RefreshTokenBody } from './auth.schema';

interface IdTokenBody {
  idToken: string;
  referralCode?: string;
}

interface SendOtpBody {
  phone: string;
}

interface VerifyOtpBody {
  phone: string;
  otp: string;
  referralCode?: string;
}

class AuthController {
  async sendOtp(
    request: FastifyRequest<{ Body: SendOtpBody }>,
    reply: FastifyReply,
  ): Promise<void> {
    await authService.sendOtp(request.body.phone);
    void reply.status(200).send({ success: true, data: { message: 'OTP sent successfully' } });
  }

  async verifyOtp(
    request: FastifyRequest<{ Body: VerifyOtpBody }>,
    reply: FastifyReply,
  ): Promise<void> {
    const { tokens, user, isNew } = await authService.verifyOtp(
      request.body.phone,
      request.body.otp,
      request.ip,
      request.body.referralCode ?? null,
    );
    void reply.status(isNew ? 201 : 200).send({
      success: true,
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: user.toPublicJSON(),
        isNew,
      },
    });
  }

  async adminSendOtp(
    request: FastifyRequest<{ Body: SendOtpBody }>,
    reply: FastifyReply,
  ): Promise<void> {
    await authService.sendOtp(request.body.phone);
    void reply.status(200).send({ success: true, data: { message: 'OTP sent successfully' } });
  }

  async adminVerifyOtp(
    request: FastifyRequest<{ Body: Omit<VerifyOtpBody, 'referralCode'> }>,
    reply: FastifyReply,
  ): Promise<void> {
    const { tokens, user, isNew } = await authService.verifyOtp(
      request.body.phone,
      request.body.otp,
      request.ip,
      null,
      'admin',
    );
    void reply.status(200).send({
      success: true,
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: user.toPublicJSON(),
        isNew,
      },
    });
  }

  async vendorSendOtp(
    request: FastifyRequest<{ Body: SendOtpBody }>,
    reply: FastifyReply,
  ): Promise<void> {
    await authService.sendOtp(request.body.phone);
    void reply.status(200).send({ success: true, data: { message: 'OTP sent successfully' } });
  }

  async vendorVerifyOtp(
    request: FastifyRequest<{ Body: Omit<VerifyOtpBody, 'referralCode'> }>,
    reply: FastifyReply,
  ): Promise<void> {
    const { tokens, user, isNew } = await authService.verifyOtp(
      request.body.phone,
      request.body.otp,
      request.ip,
      null,
      'vendor',
    );

    // Safely extract ID (handle both model instance and plain object cases)
    const userId = user.id || (user as any).dataValues?.id;
    
    if (!userId) {
      console.error('[vendorVerifyOtp] FAILED to get userId from user object:', JSON.stringify(user, null, 2));
    }

    const store = await storeService.findByOwnerId(userId);

    const isStoreActive: boolean = store
      ? (store.isActive ?? (store as any).dataValues?.is_active ?? false)
      : false;

    void reply.status(isNew ? 201 : 200).send({
      success: true,
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: user.toPublicJSON(),
        isNew,
        store: store?.toPublicJSON() ?? null,
        isStoreActive,
      },
    });
  }

  async googleSignIn(
    request: FastifyRequest<{ Body: IdTokenBody }>,
    reply: FastifyReply,
  ): Promise<void> {
    const { tokens, user, isNew } = await authService.googleSignIn(request.body.idToken, request.ip, request.body.referralCode ?? null);
    void reply.status(isNew ? 201 : 200).send({
      success: true,
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: user.toPublicJSON(),
        isNew,
      },
    });
  }

  async appleSignIn(
    request: FastifyRequest<{ Body: IdTokenBody }>,
    reply: FastifyReply,
  ): Promise<void> {
    const { tokens, user, isNew } = await authService.appleSignIn(request.body.idToken, request.ip, request.body.referralCode ?? null);
    void reply.status(isNew ? 201 : 200).send({
      success: true,
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: user.toPublicJSON(),
        isNew,
      },
    });
  }

  async refresh(
    request: FastifyRequest<{ Body: RefreshTokenBody }>,
    reply: FastifyReply,
  ): Promise<void> {
    const tokens = await authService.refreshAccessToken(request.body.refreshToken);
    void reply.status(200).send({ 
      success: true, 
      data: { 
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken 
      } 
    });
  }

  async logout(
    request: FastifyRequest<{ Body: RefreshTokenBody }>,
    reply: FastifyReply,
  ): Promise<void> {
    await authService.logout(request.body.refreshToken);
    void reply.status(200).send({ success: true, data: { message: 'Logged out successfully' } });
  }

  async validateReferral(
    request: FastifyRequest<{ Params: { code: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const result = await userService.validateReferralCode(request.params.code);
    if (!result) {
      void reply.status(404).send({
        success: false,
        error: { code: 'INVALID_REFERRAL_CODE', message: 'The referral code is invalid' },
      });
      return;
    }
    void reply.status(200).send({ success: true, data: result });
  }
}

export default new AuthController();
