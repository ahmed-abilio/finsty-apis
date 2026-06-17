import { FastifyInstance } from 'fastify';
import authController from './auth.controller';
import {
  sendOtpSchema,
  verifyOtpSchema,
  googleSignInSchema,
  appleSignInSchema,
  refreshTokenSchema,
  logoutSchema,
  createAdminSchema,
  adminSendOtpSchema,
  adminVerifyOtpSchema,
  vendorSendOtpSchema,
  vendorVerifyOtpSchema,
  validateReferralSchema,
  RefreshTokenBody,
} from './auth.schema';

export default async function authRoutes(fastify: FastifyInstance): Promise<void> {
  // Public auth routes — no authenticate hook
  fastify.get(
    '/validate-referral/:code',
    { schema: validateReferralSchema },
    authController.validateReferral.bind(authController),
  );
  fastify.post(
    '/send-otp',
    { schema: sendOtpSchema },
    authController.sendOtp.bind(authController),
  );

  fastify.post(
    '/verify-otp',
    { schema: verifyOtpSchema },
    authController.verifyOtp.bind(authController),
  );

  // Admin auth routes
  fastify.post(
    '/admin/create',
    { schema: createAdminSchema },
    authController.createAdmin.bind(authController),
  );

  fastify.post(
    '/admin/send-otp',
    { schema: adminSendOtpSchema },
    authController.adminSendOtp.bind(authController),
  );

  fastify.post(
    '/admin/verify-otp',
    { schema: adminVerifyOtpSchema },
    authController.adminVerifyOtp.bind(authController),
  );

  // Vendor auth routes
  fastify.post(
    '/vendor/send-otp',
    { schema: vendorSendOtpSchema },
    authController.vendorSendOtp.bind(authController),
  );

  fastify.post(
    '/vendor/verify-otp',
    { schema: vendorVerifyOtpSchema },
    authController.vendorVerifyOtp.bind(authController),
  );

  fastify.post(
    '/google',
    { schema: googleSignInSchema },
    authController.googleSignIn.bind(authController),
  );

  fastify.post(
    '/apple',
    { schema: appleSignInSchema },
    authController.appleSignIn.bind(authController),
  );

  fastify.post(
    '/refresh',
    { schema: refreshTokenSchema },
    authController.refresh.bind(authController),
  );

  // Logout requires a valid access token
  fastify.post<{ Body: RefreshTokenBody }>(
    '/logout',
    {
      schema: logoutSchema,
      onRequest: [fastify.authenticate],
    },
    authController.logout.bind(authController),
  );
}
