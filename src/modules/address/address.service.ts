import Address, { AddressCreationAttributes, AddressLabel } from './address.model';
import { AppError } from '@utils/appError';

export interface CreateAddressInput {
  label?: AddressLabel;
  receiverName: string;
  receiverPhone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  isDefault?: boolean;
}

export interface UpdateAddressInput {
  label?: AddressLabel;
  receiverName?: string;
  receiverPhone?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
}

class AddressService {
  async list(userId: string): Promise<Address[]> {
    const raw = await Address.findAll({ where: { userId }, raw: true });
    console.log(raw);
    return await Address.findAll({
      where: { userId },
      order: [['isDefault', 'DESC'], ['createdAt', 'ASC']],
    });
  }

  async create(userId: string, input: CreateAddressInput): Promise<Address> {
    // If this is the first address or isDefault requested, clear other defaults first
    if (input.isDefault) {
      await Address.update({ isDefault: false }, { where: { userId } });
    } else {
      const count = await Address.count({ where: { userId } });
      if (count === 0) input.isDefault = true; // first address is always default
    }

    return Address.create({
      userId,
      label: input.label ?? null,
      receiverName: input.receiverName,
      receiverPhone: input.receiverPhone,
      line1: input.line1,
      line2: input.line2 ?? null,
      city: input.city,
      state: input.state,
      postalCode: input.postalCode,
      country: input.country ?? 'India',
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      isDefault: input.isDefault ?? false,
    } as AddressCreationAttributes);
  }

  async update(id: string, userId: string, input: UpdateAddressInput): Promise<Address> {
    const address = await this.findOwned(id, userId);

    if (input.label !== undefined) address.label = input.label;
    if (input.receiverName !== undefined) address.receiverName = input.receiverName;
    if (input.receiverPhone !== undefined) address.receiverPhone = input.receiverPhone;
    if (input.line1 !== undefined) address.line1 = input.line1;
    if (input.line2 !== undefined) address.line2 = input.line2;
    if (input.city !== undefined) address.city = input.city;
    if (input.state !== undefined) address.state = input.state;
    if (input.postalCode !== undefined) address.postalCode = input.postalCode;
    if (input.country !== undefined) address.country = input.country;
    if (input.latitude !== undefined) address.latitude = input.latitude;
    if (input.longitude !== undefined) address.longitude = input.longitude;

    await address.save();
    return address;
  }

  async delete(id: string, userId: string): Promise<void> {
    const address = await this.findOwned(id, userId);
    const wasDefault = address.isDefault;
    await address.destroy();

    // Promote the oldest remaining address to default if we deleted the default
    if (wasDefault) {
      const next = await Address.findOne({
        where: { userId },
        order: [['createdAt', 'ASC']],
      });
      if (next) {
        next.isDefault = true;
        await next.save();
      }
    }
  }

  async setDefault(id: string, userId: string): Promise<Address> {
    const address = await this.findOwned(id, userId);
    await Address.update({ isDefault: false }, { where: { userId } });
    address.isDefault = true;
    await address.save();
    return address;
  }

  async findOwned(id: string, userId: string): Promise<Address> {
    const address = await Address.findOne({ where: { id, userId } });
    if (!address) throw AppError.notFound('Address not found', 'ADDRESS_NOT_FOUND');
    return address;
  }
}

export default new AddressService();
