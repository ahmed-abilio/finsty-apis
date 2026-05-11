import { FastifyRequest, FastifyReply } from 'fastify';
import wishlistService from './wishlist.service';

interface ProductIdParams {
  productId: string;
}

interface AddBody {
  productId: string;
}

class WishlistController {
  async getWishlist(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const items = await wishlistService.getWishlist(request.user.sub);
    void reply.status(200).send({ success: true, data: items });
  }

  async addToWishlist(
    request: FastifyRequest<{ Body: AddBody }>,
    reply: FastifyReply,
  ): Promise<void> {
    const wishlist = await wishlistService.addToWishlist(
      request.user.sub,
      request.body.productId,
    );
    void reply.status(201).send({ success: true, data: wishlist });
  }

  async removeFromWishlist(
    request: FastifyRequest<{ Params: ProductIdParams }>,
    reply: FastifyReply,
  ): Promise<void> {
    const wishlist = await wishlistService.removeFromWishlist(
      request.user.sub,
      request.params.productId,
    );
    void reply.status(200).send({ success: true, data: wishlist });
  }

  async toggleWishlist(
    request: FastifyRequest<{ Params: ProductIdParams }>,
    reply: FastifyReply,
  ): Promise<void> {
    const result = await wishlistService.toggleWishlist(
      request.user.sub,
      request.params.productId,
    );
    void reply.status(200).send({ success: true, data: result });
  }
}

export default new WishlistController();
