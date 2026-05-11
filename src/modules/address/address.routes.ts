import { FastifyInstance } from 'fastify';
import addressController from './address.controller';
import {
  listAddressesSchema,
  createAddressSchema,
  updateAddressSchema,
  deleteAddressSchema,
  setDefaultAddressSchema,
} from './address.schema';

export default async function addressRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('onRequest', fastify.authenticate);

  fastify.get('/', { schema: listAddressesSchema }, addressController.list.bind(addressController));

  fastify.post('/', { schema: createAddressSchema }, addressController.create.bind(addressController));

  fastify.patch('/:addressId', { schema: updateAddressSchema }, addressController.update.bind(addressController));

  fastify.delete('/:addressId', { schema: deleteAddressSchema }, addressController.delete.bind(addressController));

  fastify.patch('/:addressId/default', { schema: setDefaultAddressSchema }, addressController.setDefault.bind(addressController));
}
