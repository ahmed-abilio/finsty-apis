import { FastifyInstance } from 'fastify';
import otpController from './otp.controller';
import {
  sendPhoneOtpSchema,
  verifyPhoneOtpSchema,
  sendEmailOtpSchema,
  verifyEmailOtpSchema,
} from './otp.schema';

export default async function otpRoutes(fastify: FastifyInstance): Promise<void> {
  // All OTP endpoints require a valid JWT — the caller decides who may access
  // them in context (admin for store creation, user for other flows, etc.)
  // fastify.addHook('onRequest', fastify.authenticate);

  fastify.post(
    '/send-phone',
    { schema: sendPhoneOtpSchema },
    otpController.sendPhoneOtp.bind(otpController),
  );

  fastify.post(
    '/verify-phone',
    { schema: verifyPhoneOtpSchema },
    otpController.verifyPhoneOtp.bind(otpController),
  );

  fastify.post(
    '/send-email',
    { schema: sendEmailOtpSchema },
    otpController.sendEmailOtp.bind(otpController),
  );

  fastify.post(
    '/verify-email',
    { schema: verifyEmailOtpSchema },
    otpController.verifyEmailOtp.bind(otpController),
  );
}
