import fp from 'fastify-plugin';
import cors from '@fastify/cors';
import { FastifyInstance } from 'fastify';

async function corsPlugin(fastify: FastifyInstance): Promise<void> {
  const rawOrigins = process.env.CORS_ORIGINS ?? 'http://localhost:3000';
  const allowedOrigins = rawOrigins.split(',').map((o) => o.trim());

  await fastify.register(cors, {
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, Postman, server-to-server)
      if (!origin) {
        callback(null, true);
        return;
      }
      if (allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin '${origin}' not allowed`), false);
      }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    credentials: true,
    maxAge: 86400,
  });
}

export default fp(corsPlugin, { name: 'cors', fastify: '4.x' });
