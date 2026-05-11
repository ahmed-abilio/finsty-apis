export type AuthProvider = 'phone' | 'google' | 'apple';

export type StoreGender = 'men' | 'women' | 'kids' | 'unisex';
export type StoreCategoryType = 'clothing' | 'footwear' | 'accessories';
export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
export type DeliveryType = 'delivery' | 'pickup';

export interface JwtPayload {
  sub: string;       // userId (UUID)
  uid: string;       // stable user identifier (phone for phone auth; firebaseUid for google/apple)
  provider: AuthProvider;
  role: string;
  iat?: number;
  exp?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUser {
  id: string;
  firebaseUid: string;
  phone: string | null;
  email: string | null;
  provider: AuthProvider;
  role: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiResponse<T = unknown> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
