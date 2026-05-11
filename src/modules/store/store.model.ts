import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@config/database';

export type StoreGender = 'men' | 'women' | 'kids' | 'unisex';
export type OnboardingStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface StoreCat {
  categoryId: string;
  subCategoryIds: string[];
}

export interface WorkingDaySchedule {
  day: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
  openingTime: string | null;
  closingTime: string | null;
}

export interface BankDetails {
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  bankName: string;
  branchName: string;
}

export interface StoreAttributes {
  id: string;
  ownerId: string | null;
  name: string;
  slug: string;
  description: string | null;
  phone: string | null;
  email: string | null;
  address: string;
  addressLine2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  latitude: number;
  longitude: number;
  logoUrl: string | null;
  bannerUrl: string | null;
  genders: StoreGender[];
  storeCategories: StoreCat[];
  workingDays: WorkingDaySchedule[];
  isHoliday: boolean;
  rating: number;
  totalRatings: number;
  isActive: boolean;
  isVerified: boolean;
  onboardingStatus: OnboardingStatus;
  shopLicenseUrl: string | null;
  panCardUrl: string | null;
  aadharCardUrl: string | null;
  additionalDocuments: string[];
  bankDetails: BankDetails | null;
  brands: string[];
  promoLabel: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface StoreCreationAttributes
  extends Optional<
    StoreAttributes,
    | 'id'
    | 'slug'
    | 'description'
    | 'phone'
    | 'email'
    | 'addressLine2'
    | 'logoUrl'
    | 'bannerUrl'
    | 'genders'
    | 'storeCategories'
    | 'workingDays'
    | 'isHoliday'
    | 'rating'
    | 'totalRatings'
    | 'isActive'
    | 'isVerified'
    | 'onboardingStatus'
    | 'shopLicenseUrl'
    | 'panCardUrl'
    | 'aadharCardUrl'
    | 'additionalDocuments'
    | 'bankDetails'
    | 'brands'
  > {}

class Store extends Model<StoreAttributes, StoreCreationAttributes> implements StoreAttributes {
  declare id: string;
  declare ownerId: string | null;
  declare name: string;
  declare slug: string;
  declare description: string | null;
  declare phone: string | null;
  declare email: string | null;
  declare address: string;
  declare addressLine2: string | null;
  declare city: string;
  declare state: string;
  declare postalCode: string;
  declare country: string;
  declare latitude: number;
  declare longitude: number;
  declare logoUrl: string | null;
  declare bannerUrl: string | null;
  declare genders: StoreGender[];
  declare storeCategories: StoreCat[];
  declare workingDays: WorkingDaySchedule[];
  declare isHoliday: boolean;
  declare rating: number;
  declare totalRatings: number;
  declare isActive: boolean;
  declare isVerified: boolean;
  declare onboardingStatus: OnboardingStatus;
  declare shopLicenseUrl: string | null;
  declare panCardUrl: string | null;
  declare aadharCardUrl: string | null;
  declare additionalDocuments: string[];
  declare bankDetails: BankDetails | null;
  declare brands: string[];
  declare promoLabel: string | null;
  declare public readonly createdAt: Date;
  declare public readonly updatedAt: Date;

  toPublicJSON(): any {
    return {
      id: this.id,
      ownerId: this.ownerId,
      name: this.name,
      slug: this.slug,
      description: this.description ?? null,
      phone: this.phone ?? null,
      email: this.email ?? null,
      address: this.address,
      addressLine2: this.addressLine2 ?? null,
      city: this.city,
      state: this.state,
      postalCode: this.postalCode,
      country: this.country,
      latitude: Number(this.latitude),
      longitude: Number(this.longitude),
      logoUrl: this.logoUrl ?? null,
      bannerUrl: this.bannerUrl ?? null,
      genders: this.genders ?? [],
      storeCategories: this.storeCategories ?? [],
      workingDays: this.workingDays ?? [],
      isHoliday: this.isHoliday,
      rating: Number(this.rating),
      totalRatings: Number(this.totalRatings),
      isActive: this.isActive,
      isVerified: this.isVerified,
      onboardingStatus: this.onboardingStatus,
      shopLicenseUrl: this.shopLicenseUrl ?? null,
      panCardUrl: this.panCardUrl ?? null,
      aadharCardUrl: this.aadharCardUrl ?? null,
      additionalDocuments: this.additionalDocuments ?? [],
      bankDetails: this.bankDetails ?? null,
      brands: this.brands ?? [],
      promoLabel: this.promoLabel ?? null,
      createdAt: this.createdAt ? new Date(this.createdAt).toISOString() : null,
      updatedAt: this.updatedAt ? new Date(this.updatedAt).toISOString() : null,
    };
  }
}

Store.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    ownerId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'owner_id',
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    slug: {
      type: DataTypes.STRING(300),
      allowNull: false,
      defaultValue: '',
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: true,
    },
    address: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    addressLine2: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'address_line2',
    },
    city: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    state: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    postalCode: {
      type: DataTypes.STRING(20),
      allowNull: false,
      field: 'postal_code',
    },
    country: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: 'India',
    },
    latitude: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: false,
    },
    longitude: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: false,
    },
    logoUrl: {
      type: DataTypes.STRING(2048),
      allowNull: true,
      field: 'logo_url',
    },
    bannerUrl: {
      type: DataTypes.STRING(2048),
      allowNull: true,
      field: 'banner_url',
    },
    genders: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: false,
      defaultValue: ['men', 'women', 'kids', 'unisex'],
    },
    storeCategories: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
      field: 'store_categories',
    },
    workingDays: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [
        { day: 'Mon', openingTime: '09:00', closingTime: '21:00' },
        { day: 'Tue', openingTime: '09:00', closingTime: '21:00' },
        { day: 'Wed', openingTime: '09:00', closingTime: '21:00' },
        { day: 'Thu', openingTime: '09:00', closingTime: '21:00' },
        { day: 'Fri', openingTime: '09:00', closingTime: '21:00' },
        { day: 'Sat', openingTime: '09:00', closingTime: '21:00' },
        { day: 'Sun', openingTime: '09:00', closingTime: '21:00' },
      ],
      field: 'working_days',
    },
    isHoliday: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_holiday',
    },
    rating: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: false,
      defaultValue: 0,
    },
    totalRatings: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'total_ratings',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_active',
    },
    isVerified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_verified',
    },
    onboardingStatus: {
      type: DataTypes.ENUM('PENDING', 'APPROVED', 'REJECTED'),
      allowNull: false,
      defaultValue: 'PENDING',
      field: 'onboarding_status',
    },
    shopLicenseUrl: {
      type: DataTypes.STRING(2048),
      allowNull: true,
      field: 'shop_license_url',
    },
    panCardUrl: {
      type: DataTypes.STRING(2048),
      allowNull: true,
      field: 'pan_card_url',
    },
    aadharCardUrl: {
      type: DataTypes.STRING(2048),
      allowNull: true,
      field: 'aadhar_card_url',
    },
    additionalDocuments: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
      field: 'additional_documents',
    },
    bankDetails: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'bank_details',
    },
    brands: {
      type: DataTypes.ARRAY(DataTypes.STRING(100)),
      allowNull: false,
      defaultValue: [],
    },
    promoLabel: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'promo_label',
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'stores',
    underscored: false,
    indexes: [
      { fields: ['owner_id'] },
      { fields: ['city'] },
      { fields: ['is_active'] },
      { fields: ['rating'] },
      { fields: ['latitude', 'longitude'] },
      { fields: ['onboarding_status'] },
      { fields: ['slug'], unique: true },
    ],
  },
);

export default Store;
