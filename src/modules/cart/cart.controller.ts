import { FastifyRequest, FastifyReply } from 'fastify';
import cartService from './cart.service';

interface CartItemParams {
  itemId: string;
}

interface GetCartQuery {
  page?: number;
  limit?: number;
  storeId?: string;
}

interface AddItemBody {
  productId: string;
  variantId?: string;
  quantity: number;
}

interface UpdateItemBody {
  quantity: number;
}

interface SelectItemBody {
  isSelected: boolean;
}

class CartController {
  async getCart(request: FastifyRequest<{ Querystring: GetCartQuery }>, reply: FastifyReply): Promise<void> {
    const page = Math.max(1, request.query.page ?? 1);
    const limit = Math.min(50, Math.max(1, request.query.limit ?? 10));
    const cart = await cartService.getCart(request.user.sub, page, limit, request.query.storeId);
    void reply.status(200).send({ success: true, data: cart });
  }

  async addItem(
    request: FastifyRequest<{ Body: AddItemBody }>,
    reply: FastifyReply,
  ): Promise<void> {
    const cart = await cartService.addItem(request.user.sub, request.body);
    void reply.status(200).send({ success: true, data: cart });
  }

  async updateItem(
    request: FastifyRequest<{ Params: CartItemParams; Body: UpdateItemBody }>,
    reply: FastifyReply,
  ): Promise<void> {
    const cart = await cartService.updateItem(
      request.user.sub,
      request.params.itemId,
      request.body.quantity,
    );
    void reply.status(200).send({ success: true, data: cart });
  }

  async removeItem(
    request: FastifyRequest<{ Params: CartItemParams }>,
    reply: FastifyReply,
  ): Promise<void> {
    const cart = await cartService.removeItem(request.user.sub, request.params.itemId);
    void reply.status(200).send({ success: true, data: cart });
  }

  async selectItem(
    request: FastifyRequest<{ Params: CartItemParams; Body: SelectItemBody }>,
    reply: FastifyReply,
  ): Promise<void> {
    const cart = await cartService.selectItem(
      request.user.sub,
      request.params.itemId,
      request.body.isSelected,
    );
    void reply.status(200).send({ success: true, data: cart });
  }

  async clearCart(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const cart = await cartService.clearCart(request.user.sub);
    void reply.status(200).send({ success: true, data: cart });
  }
}

export default new CartController();
