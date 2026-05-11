import { FastifyInstance } from 'fastify';
import wishlistController from './wishlist.controller';
import {
  getWishlistSchema,
  addToWishlistSchema,
  removeFromWishlistSchema,
  toggleWishlistSchema,
} from './wishlist.schema';

export default async function wishlistRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('onRequest', fastify.authenticate);

  fastify.get('/', { schema: getWishlistSchema }, wishlistController.getWishlist.bind(wishlistController));

  fastify.post('/', { schema: addToWishlistSchema }, wishlistController.addToWishlist.bind(wishlistController));

  fastify.delete('/:productId', { schema: removeFromWishlistSchema }, wishlistController.removeFromWishlist.bind(wishlistController));

  fastify.post('/:productId/toggle', { schema: toggleWishlistSchema }, wishlistController.toggleWishlist.bind(wishlistController));
}
