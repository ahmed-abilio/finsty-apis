import { FastifyInstance } from 'fastify';
import cartController from './cart.controller';
import {
  getCartSchema,
  addCartItemSchema,
  updateCartItemSchema,
  removeCartItemSchema,
  clearCartSchema,
  selectCartItemSchema,
} from './cart.schema';

export default async function cartRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('onRequest', fastify.authenticate);

  fastify.get('/', { schema: getCartSchema }, cartController.getCart.bind(cartController));

  fastify.post('/items', { schema: addCartItemSchema }, cartController.addItem.bind(cartController));

  fastify.patch('/items/:itemId', { schema: updateCartItemSchema }, cartController.updateItem.bind(cartController));

  fastify.patch('/items/:itemId/select', { schema: selectCartItemSchema }, cartController.selectItem.bind(cartController));

  fastify.delete('/items/:itemId', { schema: removeCartItemSchema }, cartController.removeItem.bind(cartController));

  fastify.delete('/', { schema: clearCartSchema }, cartController.clearCart.bind(cartController));
}
