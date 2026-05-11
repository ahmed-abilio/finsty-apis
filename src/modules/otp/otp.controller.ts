import { FastifyRequest, FastifyReply } from 'fastify';
import otpService from './otp.service';

class OtpController {
  async sendPhoneOtp(
    request: FastifyRequest<{ Body: { phone: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    await otpService.sendPhoneOtp(request.body.phone);
    void reply.status(200).send({ success: true, data: { message: 'OTP sent to phone' } });
  }

  async verifyPhoneOtp(
    request: FastifyRequest<{ Body: { phone: string; otp: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    await otpService.verifyPhoneOtp(request.body.phone, request.body.otp);
    void reply.status(200).send({ success: true, data: { verified: true } });
  }

  async sendEmailOtp(
    request: FastifyRequest<{ Body: { email: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    await otpService.sendEmailOtp(request.body.email);
    void reply.status(200).send({ success: true, data: { message: 'OTP sent to email' } });
  }

  async verifyEmailOtp(
    request: FastifyRequest<{ Body: { email: string; otp: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    await otpService.verifyEmailOtp(request.body.email, request.body.otp);
    void reply.status(200).send({ success: true, data: { verified: true } });
  }
}

export default new OtpController();
