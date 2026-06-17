import { FastifyRequest, FastifyReply } from 'fastify';
import * as authService from './auth.service';
import userService from '../user/user.service';
import storeService from '../store/store.service';
import { RefreshTokenBody } from './auth.schema';
import { NotificationType } from '@modules/notification/notification.types';
import { notifyAdmin, notifyUser, notifyVendor } from '@modules/notification/notification.service';
import {
  assertDeviceTokenPayloadValid,
  registerDeviceTokenFromAuth,
  type DeviceTokenAuthInput,
} from '@modules/notification/device-token-registration';
import { Roles } from '@modules/user/user.model';

interface IdTokenBody extends DeviceTokenAuthInput {
  idToken: string;
  referralCode?: string;
}

interface SendOtpBody {
  phone: string;
}

interface VerifyOtpBody extends DeviceTokenAuthInput {
  phone: string;
  otp: string;
  referralCode?: string;
}

interface RoleVerifyOtpBody extends DeviceTokenAuthInput {
  phone: string;
  otp: string;
}

interface CreateAdminBody {
  phone: string;
  superKey: string;
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
    assertDeviceTokenPayloadValid(request.body);
    const { tokens, user, isNew } = await authService.verifyOtp(
      request.body.phone,
      request.body.otp,
      request.ip,
      request.body.referralCode ?? null,
    );
    await registerDeviceTokenFromAuth(user.id, Roles.USER, request.body);
    notifyUser(user.id, NotificationType.LOGIN_SUCCESS);
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

  async createAdmin(
    request: FastifyRequest<{ Body: CreateAdminBody }>,
    reply: FastifyReply,
  ): Promise<void> {
    const user = await authService.createAdmin(request.body.phone, request.body.superKey);
    void reply.status(201).send({
      success: true,
      data: {
        user: user.toPublicJSON(),
        message: 'Admin account created. Use admin OTP login to sign in.',
      },
    });
  }

  async adminVerifyOtp(
    request: FastifyRequest<{ Body: RoleVerifyOtpBody }>,
    reply: FastifyReply,
  ): Promise<void> {
    assertDeviceTokenPayloadValid(request.body);
    const { tokens, user, isNew } = await authService.verifyOtp(
      request.body.phone,
      request.body.otp,
      request.ip,
      null,
      'admin',
    );
    await registerDeviceTokenFromAuth(user.id, Roles.ADMIN, request.body);
    notifyAdmin(user.id, NotificationType.LOGIN_SUCCESS);
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
    request: FastifyRequest<{ Body: RoleVerifyOtpBody }>,
    reply: FastifyReply,
  ): Promise<void> {
    assertDeviceTokenPayloadValid(request.body);
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

    if (userId) {
      await registerDeviceTokenFromAuth(userId, Roles.VENDOR, request.body);
      notifyVendor(userId, NotificationType.LOGIN_SUCCESS);
    }

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
    assertDeviceTokenPayloadValid(request.body);
    const { tokens, user, isNew } = await authService.googleSignIn(request.body.idToken, request.ip, request.body.referralCode ?? null);
    await registerDeviceTokenFromAuth(user.id, Roles.USER, request.body);
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
    assertDeviceTokenPayloadValid(request.body);
    const { tokens, user, isNew } = await authService.appleSignIn(request.body.idToken, request.ip, request.body.referralCode ?? null);
    await registerDeviceTokenFromAuth(user.id, Roles.USER, request.body);
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
    assertDeviceTokenPayloadValid(request.body);
    const { tokens, userId, role } = await authService.refreshAccessToken(request.body.refreshToken);
    await registerDeviceTokenFromAuth(userId, role, request.body);
    void reply.status(200).send({
      success: true,
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
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
