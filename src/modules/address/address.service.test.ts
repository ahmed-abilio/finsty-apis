import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findAllMock: vi.fn(),
  updateMock: vi.fn(),
}));

vi.mock('./address.model', () => ({
  default: {
    findAll: mocks.findAllMock,
    update: mocks.updateMock,
    count: vi.fn(),
    create: vi.fn(),
    findOne: vi.fn(),
  },
}));

import addressService, { sortAddressesDefaultFirst } from './address.service';
import type Address from './address.model';

function makeAddress(overrides: Partial<Address> & { id: string; isDefault: boolean; createdAt: Date }) {
  return {
    receiverName: 'Test',
    receiverPhone: '9999999999',
    line1: 'Line 1',
    city: 'City',
    state: 'State',
    postalCode: '110001',
    country: 'India',
    updatedAt: overrides.createdAt,
    ...overrides,
  } as Address;
}

describe('sortAddressesDefaultFirst', () => {
  it('places default address before non-default regardless of createdAt', () => {
    const olderDefault = makeAddress({
      id: 'a1',
      isDefault: true,
      createdAt: new Date('2024-01-01'),
    });
    const newerOther = makeAddress({
      id: 'a2',
      isDefault: false,
      createdAt: new Date('2025-01-01'),
    });

    const sorted = sortAddressesDefaultFirst([newerOther, olderDefault]);
    expect(sorted.map((a) => a.id)).toEqual(['a1', 'a2']);
  });

  it('orders non-default addresses by createdAt ascending', () => {
    const first = makeAddress({
      id: 'a1',
      isDefault: false,
      createdAt: new Date('2024-01-01'),
    });
    const second = makeAddress({
      id: 'a2',
      isDefault: false,
      createdAt: new Date('2024-06-01'),
    });

    const sorted = sortAddressesDefaultFirst([second, first]);
    expect(sorted.map((a) => a.id)).toEqual(['a1', 'a2']);
  });
});

describe('addressService.list', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateMock.mockResolvedValue([1]);
  });

  it('returns default address first via post-fetch sort', async () => {
    const defaultAddr = makeAddress({
      id: 'default-id',
      isDefault: true,
      createdAt: new Date('2024-06-01'),
    });
    const otherAddr = makeAddress({
      id: 'other-id',
      isDefault: false,
      createdAt: new Date('2024-01-01'),
    });

    mocks.findAllMock.mockResolvedValueOnce([otherAddr, defaultAddr]);

    const result = await addressService.list('user-1');

    expect(result.map((a) => a.id)).toEqual(['default-id', 'other-id']);
    expect(mocks.updateMock).not.toHaveBeenCalled();
  });

  it('normalizes multiple defaults and reloads the list', async () => {
    const keeper = makeAddress({
      id: 'keeper',
      isDefault: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2025-01-02'),
    });
    const stale = makeAddress({
      id: 'stale',
      isDefault: true,
      createdAt: new Date('2024-02-01'),
      updatedAt: new Date('2024-06-01'),
    });
    const other = makeAddress({
      id: 'other',
      isDefault: false,
      createdAt: new Date('2024-03-01'),
      updatedAt: new Date('2024-03-01'),
    });

    const afterNormalize = [
      { ...keeper, isDefault: true },
      { ...stale, isDefault: false },
      other,
    ];

    mocks.findAllMock
      .mockResolvedValueOnce([stale, keeper, other])
      .mockResolvedValueOnce(afterNormalize);

    const result = await addressService.list('user-1');

    expect(mocks.updateMock).toHaveBeenCalledWith(
      { isDefault: false },
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'user-1' }),
      }),
    );
    expect(result[0]!.id).toBe('keeper');
    expect(mocks.findAllMock).toHaveBeenCalledTimes(2);
  });
});
