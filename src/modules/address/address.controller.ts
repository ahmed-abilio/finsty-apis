import { FastifyRequest, FastifyReply } from 'fastify';
import addressService, { CreateAddressInput, UpdateAddressInput } from './address.service';

interface AddressParams {
  addressId: string;
}

class AddressController {
  async list(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const addresses = await addressService.list(request.user.sub);
    void reply.status(200).send({
      success: true,
      data: { addresses: addresses.map((a) => a.toPublicJSON()) },
    });
  }

  async create(
    request: FastifyRequest<{ Body: CreateAddressInput }>,
    reply: FastifyReply,
  ): Promise<void> {
    const address = await addressService.create(request.user.sub, request.body);
    void reply.status(201).send({ success: true, data: { address: address.toPublicJSON() } });
  }

  async update(
    request: FastifyRequest<{ Params: AddressParams; Body: UpdateAddressInput }>,
    reply: FastifyReply,
  ): Promise<void> {
    const address = await addressService.update(
      request.params.addressId,
      request.user.sub,
      request.body,
    );
    void reply.status(200).send({ success: true, data: { address: address.toPublicJSON() } });
  }

  async delete(
    request: FastifyRequest<{ Params: AddressParams }>,
    reply: FastifyReply,
  ): Promise<void> {
    await addressService.delete(request.params.addressId, request.user.sub);
    void reply.status(200).send({ success: true, data: { message: 'Address deleted successfully' } });
  }

  async setDefault(
    request: FastifyRequest<{ Params: AddressParams }>,
    reply: FastifyReply,
  ): Promise<void> {
    const address = await addressService.setDefault(request.params.addressId, request.user.sub);
    void reply.status(200).send({ success: true, data: { address: address.toPublicJSON() } });
  }
}

export default new AddressController();
