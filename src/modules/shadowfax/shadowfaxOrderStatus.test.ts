import { describe, it, expect } from 'vitest';
import { parseShadowfaxOrderStatusResponse } from './shadowfaxOrderStatus.types';

const samplePayload = {
  message: 'Success',
  data: {
    client_code: 'merchant001',
    status: 'ALLOTTED',
    rider_details: {
      rider_name: 'Amit Kumar',
      rider_location: {
        longitude: '77.61393159627914429',
        latitude: '12.93254403880876424',
      },
      rider_phone: '9877654321',
    },
    sfx_order_id: 20611002,
    order_details: {
      order_value: 248,
      scheduled_time: '2019-04-10T18:15:54.992Z',
      paid: 'false',
      preparation_time: 10,
      client_order_id: '379984400',
      pickup_eta: 12,
      drop_eta: 20,
      allot_time: null,
      arrival_time: null,
      dispatch_time: null,
      delivery_time: null,
      vehicle_number: null,
      order_date: '2019-04-10',
    },
    drop_details: {
      latitude: 28.588891,
      city: 'Delhi',
      name: 'Customer name',
      longitude: 77.037531,
      address: 'Customer address in plain text',
    },
    order_items: [
      {
        id: '29656019',
        name: 'Item name',
        quantity: 3,
        price: 259,
        weight: null,
        category: null,
        unit_price: 259,
      },
    ],
    track_url: 'http://api.shadowfax.in/track/612DD77D2422061560174C3E685FE7C2/',
    drop_image_url: 'some_url',
    pickup_details: {
      city: 'Delhi',
      contact_number: '9876543210',
      name: 'Store name',
      longitude: 77.0563207,
      address: 'Store address in plain text',
      latitude: 28.5833332,
    },
  },
};

describe('parseShadowfaxOrderStatusResponse', () => {
  it('unwraps message + data wrapper', () => {
    const parsed = parseShadowfaxOrderStatusResponse(samplePayload);
    expect(parsed.status).toBe('ALLOTTED');
    expect(parsed.sfx_order_id).toBe(20611002);
    expect(parsed.rider_details?.rider_name).toBe('Amit Kumar');
    expect(parsed.track_url).toContain('shadowfax.in');
  });

  it('accepts bare data object', () => {
    const parsed = parseShadowfaxOrderStatusResponse(samplePayload.data);
    expect(parsed.status).toBe('ALLOTTED');
  });
});
