import fp from 'fastify-plugin';
import multipart from '@fastify/multipart';
import { FastifyInstance } from 'fastify';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

async function multipartPlugin(fastify: FastifyInstance): Promise<void> {
  await fastify.register(multipart, {
    limits: {
      fieldNameSize: 200,
      fieldSize: 1024 * 1024,     // 1 MB per field
      fields: 20,
      fileSize: MAX_FILE_SIZE,
      files: 5,
      headerPairs: 2000,
    },
  });
}

export default fp(multipartPlugin, { name: 'multipart', fastify: '4.x' });
