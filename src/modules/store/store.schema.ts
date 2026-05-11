import { FastifySchema } from 'fastify';

const unauthorized = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    error: { type: 'object', properties: { code: { type: 'string' }, message: { type: 'string' } } },
  },
} as const;

const notFound = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    error: { type: 'object', properties: { code: { type: 'string' }, message: { type: 'string' } } },
  },
} as const;

const conflict = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    error: { type: 'object', properties: { code: { type: 'string' }, message: { type: 'string' } } },
  },
} as const;

// ─── Shared sub-schemas ───────────────────────────────────────────────────────

const workingDayScheduleItem = {
  type: 'object',
  properties: {
    day: { type: 'string', enum: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
    openingTime: { type: ['string', 'null'], description: 'Opening time in HH:MM format' },
    closingTime: { type: ['string', 'null'], description: 'Closing time in HH:MM format' },
  },
} as const;

const bankDetailsObject = {
  type: 'object',
  properties: {
    accountHolderName: { type: 'string' },
    accountNumber: { type: 'string' },
    ifscCode: { type: 'string' },
    bankName: { type: 'string' },
    branchName: { type: 'string' },
  },
} as const;

// Public store shape — excludes sensitive KYC / banking fields
const storeObject = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    ownerId: { type: 'string' },
    name: { type: 'string' },
    slug: { type: 'string' },
    description: { type: ['string', 'null'] },
    phone: { type: ['string', 'null'] },
    email: { type: ['string', 'null'] },
    address: { type: 'string' },
    addressLine2: { type: ['string', 'null'] },
    city: { type: 'string' },
    state: { type: 'string' },
    postalCode: { type: 'string' },
    country: { type: 'string' },
    latitude: { type: 'number' },
    longitude: { type: 'number' },
    logoUrl: { type: ['string', 'null'] },
    bannerUrl: { type: ['string', 'null'] },
    genders: { type: 'array', items: { type: 'string' } },
    storeCategories: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          categoryId: { type: 'string' },
          subCategoryIds: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    workingDays: { type: 'array', items: workingDayScheduleItem },
    isHoliday: { type: 'boolean' },
    rating: { type: 'number' },
    totalRatings: { type: 'number' },
    isActive: { type: 'boolean' },
    isVerified: { type: 'boolean' },
    onboardingStatus: { type: 'string', enum: ['PENDING', 'APPROVED', 'REJECTED'] },
    brands: { type: 'array', items: { type: 'string', format: 'uuid' }, description: 'Brand UUIDs from the master brands table carried by this store' },
    promoLabel: { type: ['string', 'null'] },
    createdAt: { type: ['string', 'null'] },
    updatedAt: { type: ['string', 'null'] },
  },
} as const;

// Admin store shape — includes KYC document URLs and bank details
const storeObjectAdmin = {
  type: 'object',
  properties: {
    ...storeObject.properties,
    shopLicenseUrl: { type: ['string', 'null'] },
    panCardUrl: { type: ['string', 'null'] },
    aadharCardUrl: { type: ['string', 'null'] },
    additionalDocuments: { type: 'array', items: { type: 'string' } },
    bankDetails: { ...bankDetailsObject, type: ['object', 'null'] },
  },
} as const;

const productVariantObject = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    productId: { type: 'string' },
    size: { type: ['string', 'null'] },
    color: { type: ['string', 'null'] },
    colorHex: { type: ['string', 'null'] },
    sku: { type: ['string', 'null'] },
    stock: { type: 'number' },
    additionalPrice: { type: 'number' },
    label: { type: 'string' },
  },
} as const;

const productImageObject = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    productId: { type: 'string' },
    url: { type: 'string' },
    position: { type: 'number' },
  },
} as const;

const colorImageObject = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    colorId: { type: 'string' },
    imageUrl: { type: 'string' },
    altText: { type: ['string', 'null'] },
    displayOrder: { type: 'number' },
  },
} as const;

const productColorObject = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    productId: { type: 'string' },
    colorName: { type: 'string' },
    colorHex: { type: ['string', 'null'] },
    images: { type: 'array', items: colorImageObject },
    variants: { type: 'array', items: productVariantObject },
  },
} as const;

const brandObject = {
  type: 'object',
  nullable: true,
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string' },
    slug: { type: 'string' },
    logo: { type: ['string', 'null'] },
    isActive: { type: 'boolean' },
    createdAt: { type: ['string', 'null'] },
    updatedAt: { type: ['string', 'null'] },
  },
} as const;

const categoryObject = {
  type: 'object',
  nullable: true,
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    description: { type: ['string', 'null'] },
    isActive: { type: 'boolean' },
  },
} as const;

const subCategoryObjectInline = {
  type: 'object',
  nullable: true,
  properties: {
    id: { type: 'string' },
    categoryId: { type: 'string' },
    name: { type: 'string' },
    description: { type: ['string', 'null'] },
    isActive: { type: 'boolean' },
  },
} as const;

const productObject = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    storeId: { type: 'string' },
    name: { type: 'string' },
    slug: { type: 'string' },
    description: { type: ['string', 'null'] },
    brand: { ...brandObject },
    gender: { type: ['string', 'null'] },
    categoryType: { type: ['string', 'null'] },
    category: { ...categoryObject },
    subCategory: { ...subCategoryObjectInline },
    basePrice: { type: 'number' },
    discountPercent: { type: 'number' },
    finalPrice: { type: 'number' },
    isActive: { type: 'boolean' },
    inStock: { type: 'boolean' },
    lowStockThreshold: { type: 'number' },
    lowStockAlert: { type: 'boolean' },
    status: { type: 'string', enum: ['draft', 'active'] },
    images: { type: 'array', items: productImageObject },
    colors: { type: 'array', items: productColorObject },
    createdAt: { type: ['string', 'null'] },
    updatedAt: { type: ['string', 'null'] },
  },
} as const;

const paginationMeta = {
  total: { type: 'number' },
  page: { type: 'number' },
  limit: { type: 'number' },
} as const;

// ─── GET /stores/:storeId/categories ─────────────────────────────────────────

const subCategoryObject = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    categoryId: { type: 'string' },
    name: { type: 'string' },
    description: { type: ['string', 'null'] },
    isActive: { type: 'boolean' },
    createdAt: { type: ['string', 'null'] },
    updatedAt: { type: ['string', 'null'] },
  },
} as const;

const categoryWithSubsObject = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    description: { type: ['string', 'null'] },
    isActive: { type: 'boolean' },
    createdAt: { type: ['string', 'null'] },
    updatedAt: { type: ['string', 'null'] },
    subCategories: { type: 'array', items: subCategoryObject },
  },
} as const;

export const getStoreCategoriesSchema: FastifySchema = {
  tags: ['Stores'],
  summary: 'Get categories and subcategories of a store',
  description: 'Returns the categories and their subcategories carried by the store.',
  params: {
    type: 'object',
    required: ['storeId'],
    properties: {
      storeId: { type: 'string', format: 'uuid' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            categories: { type: 'array', items: categoryWithSubsObject },
          },
        },
      },
    },
    404: notFound,
  },
};

// ─── GET /stores ──────────────────────────────────────────────────────────────

export const listStoresSchema: FastifySchema = {
  tags: ['Stores'],
  summary: 'Discover and search stores',
  description:
    'Search and filter stores. Provide `lat`+`lng` for nearby results sorted by distance. ' +
    'Without coordinates, results are sorted by rating.',
  querystring: {
    type: 'object',
    properties: {
      lat: { type: 'number', minimum: -90, maximum: 90, description: 'User latitude' },
      lng: { type: 'number', minimum: -180, maximum: 180, description: 'User longitude' },
      radiusKm: { type: 'number', minimum: 1, maximum: 100, description: 'Search radius in km. Defaults to GEOFENCE_RADIUS_KM env var if not provided.' },
      gender: {
        type: 'string',
        enum: ['men', 'women', 'kids', 'unisex'],
        description: 'Filter by gender category',
      },
      categoryId: {
        type: 'string',
        description: 'Filter by category ID (UUID)',
      },
      minRating: { type: 'number', minimum: 0, maximum: 5, description: 'Minimum store rating' },
      search: { type: 'string', description: 'Search by store name, description, or city' },
      city: { type: 'string', description: 'Filter by city name' },
      page: { type: 'number', minimum: 1, default: 1 },
      limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
      isActive: { 
        anyOf: [
          { type: 'boolean' },
          { type: 'string', enum: ['all'] }
        ],
        description: 'Filter by active status. Use "all" to see everything (Admin/Debug).'
      },
      onboardingStatus: {
        type: 'string',
        enum: ['PENDING', 'APPROVED', 'REJECTED'],
        description: 'Filter by onboarding status'
      },
    },
    additionalProperties: false,
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            stores: { type: 'array', items: storeObject },
            ...paginationMeta,
          },
        },
      },
    },
    401: unauthorized,
  },
};

// ─── GET /stores/:storeId ─────────────────────────────────────────────────────

export const getStoreSchema: FastifySchema = {
  tags: ['Stores'],
  summary: 'Get store profile',
  params: {
    type: 'object',
    required: ['storeId'],
    properties: { storeId: { type: 'string', format: 'uuid' } },
  },
  querystring: {
    type: 'object',
    properties: {
      isActive: { type: 'boolean', description: 'Filter by active status. Omit for default behaviour (active only for public, any for admin).' },
    },
    additionalProperties: false,
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { store: storeObject } },
      },
    },
    401: unauthorized,
    404: notFound,
  },
};

// ─── GET /stores/:storeId/products ────────────────────────────────────────────

export const listStoreProductsSchema: FastifySchema = {
  tags: ['Stores'],
  summary: 'Browse a store\'s product catalog',
  params: {
    type: 'object',
    required: ['storeId'],
    properties: { storeId: { type: 'string', format: 'uuid' } },
  },
  querystring: {
    type: 'object',
    properties: {
      gender: { type: 'string', enum: ['men', 'women', 'kids', 'unisex'] },
      categoryType: { type: 'string', description: 'Filter by product category type' },
      brand: { type: 'string' },
      minPrice: { type: 'number', minimum: 0 },
      maxPrice: { type: 'number', minimum: 0 },
      inStock: { type: 'boolean' },
      search: { type: 'string', description: 'Search by product name or brand' },
      page: { type: 'number', minimum: 1, default: 1 },
      limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
    },
    additionalProperties: false,
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            products: { type: 'array', items: productObject },
            ...paginationMeta,
          },
        },
      },
    },
    401: unauthorized,
    404: notFound,
  },
};

// ─── POST /stores ─────────────────────────────────────────────────────────────
// Any authenticated user may submit a vendor application.
// ownerId is injected from the JWT — not accepted in the request body.

export const createStoreSchema: FastifySchema = {
  tags: ['Stores'],
  summary: 'Submit a store application (Pre-authenticated)',
  description:
    'Submit store details, KYC documents, and bank information for admin review. ' +
    'The user must be pre-authenticated or provide a valid `ownerId`. ' +
    'The store is created in PENDING status and becomes active only after admin approval.',
  body: {
    type: 'object',
    required: ['name', 'address', 'city', 'state', 'postalCode', 'latitude', 'longitude'],
    additionalProperties: false,
    properties: {
      ownerId: { type: 'string', description: 'UUID of the user (owner)' },
      name: { type: 'string', maxLength: 255, description: 'Store display name' },
      description: { type: 'string', description: 'Short store description' },
      phone: { type: 'string', maxLength: 20, description: 'Store contact phone (must be OTP-verified)' },
      email: { type: 'string', maxLength: 255, description: 'Store contact email (must be OTP-verified)' },
      address: { type: 'string', maxLength: 500, description: 'Primary street address' },
      addressLine2: { type: 'string', maxLength: 500, description: 'Suite, floor, landmark (optional)' },
      city: { type: 'string', maxLength: 100 },
      state: { type: 'string', maxLength: 100 },
      postalCode: { type: 'string', maxLength: 20 },
      country: { type: 'string', maxLength: 100, default: 'India' },
      latitude: { type: 'number', minimum: -90, maximum: 90 },
      longitude: { type: 'number', minimum: -180, maximum: 180 },
      logoUrl: { type: 'string', maxLength: 2048 },
      bannerUrl: { type: 'string', maxLength: 2048 },
      genders: { type: 'array', items: { type: 'string', enum: ['men', 'women', 'kids', 'unisex'] } },
      storeCategories: {
        type: 'array',
        items: {
          type: 'object',
          required: ['categoryId', 'subCategoryIds'],
          properties: {
            categoryId: { type: 'string' },
            subCategoryIds: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      workingDays: { type: 'array', items: workingDayScheduleItem, description: 'Per-day schedule' },
      isHoliday: { type: 'boolean', default: false },
      brands: {
        type: 'array',
        items: { type: 'string', format: 'uuid' },
        description: 'Brand UUIDs from the master brands table (GET /brands). All IDs must exist and be active.',
      },
      promoLabel: { type: 'string', maxLength: 255 },
      // KYC documents
      shopLicenseUrl: { type: 'string', maxLength: 2048, description: 'S3 URL of shop/trade license' },
      panCardUrl: { type: 'string', maxLength: 2048, description: 'S3 URL of PAN card' },
      aadharCardUrl: { type: 'string', maxLength: 2048, description: 'S3 URL of Aadhar card' },
      additionalDocuments: {
        type: 'array',
        items: { type: 'string', maxLength: 2048 },
        description: 'S3 URLs of any supplementary documents',
      },
      // Bank details
      bankDetails: {
        type: 'object',
        required: ['accountHolderName', 'accountNumber', 'ifscCode', 'bankName', 'branchName'],
        description: 'Bank account details for vendor payouts',
        properties: {
          accountHolderName: { type: 'string', maxLength: 255 },
          accountNumber: { type: 'string', maxLength: 30, description: '9–18 digit account number' },
          ifscCode: { type: 'string', maxLength: 11, description: 'IFSC code (e.g. HDFC0001234)' },
          bankName: { type: 'string', maxLength: 255 },
          branchName: { type: 'string', maxLength: 255 },
        },
        additionalProperties: false,
      },
    },
  },
  response: {
    201: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { store: storeObjectAdmin } },
      },
    },
    409: conflict,
  },
};

// ─── PATCH /stores/:storeId/approval ─────────────────────────────────────────
// Admin-only: approve or reject a vendor application.

export const approveVendorSchema: FastifySchema = {
  tags: ['Stores'],
  summary: 'Approve or reject a vendor application (admin only)',
  description:
    'Updates the onboarding status of a store application. ' +
    'Approving atomically sets the store active and upgrades the owner\'s role to VENDOR.',
  security: [{ BearerAuth: [] }],
  params: {
    type: 'object',
    required: ['storeId'],
    properties: { storeId: { type: 'string', format: 'uuid', description: 'UUID of the store application' } },
  },
  body: {
    type: 'object',
    required: ['status'],
    additionalProperties: false,
    properties: {
      status: {
        type: 'string',
        enum: ['APPROVED', 'REJECTED'],
        description: 'Decision on the vendor application',
      },
      remarks: {
        type: 'string',
        maxLength: 1000,
        description: 'Optional admin remarks (useful for rejection reason)',
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { store: storeObjectAdmin } },
      },
    },
    400: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error: { type: 'object', properties: { code: { type: 'string' }, message: { type: 'string' } } },
      },
    },
    401: unauthorized,
    404: notFound,
    409: conflict,
  },
};

// ─── PATCH /stores/:storeId ───────────────────────────────────────────────────

export const updateStoreSchema: FastifySchema = {
  tags: ['Stores'],
  summary: 'Update a store (admin only)',
  security: [{ BearerAuth: [] }],
  params: {
    type: 'object',
    required: ['storeId'],
    properties: { storeId: { type: 'string', format: 'uuid' } },
  },
  body: {
    type: 'object',
    additionalProperties: false,
    properties: {
      ownerId: { type: 'string' },
      name: { type: 'string', maxLength: 255 },
      description: { type: 'string' },
      phone: { type: 'string', maxLength: 20 },
      email: { type: 'string', maxLength: 255 },
      address: { type: 'string', maxLength: 500 },
      addressLine2: { type: 'string', maxLength: 500 },
      city: { type: 'string', maxLength: 100 },
      state: { type: 'string', maxLength: 100 },
      postalCode: { type: 'string', maxLength: 20 },
      country: { type: 'string', maxLength: 100 },
      latitude: { type: 'number', minimum: -90, maximum: 90 },
      longitude: { type: 'number', minimum: -180, maximum: 180 },
      logoUrl: { type: 'string', maxLength: 2048 },
      bannerUrl: { type: 'string', maxLength: 2048 },
      genders: { type: 'array', items: { type: 'string', enum: ['men', 'women', 'kids', 'unisex'] } },
      storeCategories: {
        type: 'array',
        items: {
          type: 'object',
          required: ['categoryId', 'subCategoryIds'],
          properties: {
            categoryId: { type: 'string' },
            subCategoryIds: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      workingDays: { type: 'array', items: workingDayScheduleItem, description: 'Per-day schedule' },
      isHoliday: { type: 'boolean' },
      brands: { type: 'array', items: { type: 'string', format: 'uuid' } },
      promoLabel: { type: 'string', maxLength: 255 },
      isActive: { type: 'boolean' },
      isVerified: { type: 'boolean' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { store: storeObjectAdmin } },
      },
    },
    401: unauthorized,
    404: notFound,
  },
};

// ─── PATCH /stores/my/brands — vendor manages own store brands ─────────────────

export const updateMyBrandsSchema: FastifySchema = {
  tags: ['Stores'],
  summary: 'Update own store brands (vendor)',
  description: 'Replaces the full brands list for the authenticated vendor\'s store.',
  security: [{ BearerAuth: [] }],
  body: {
    type: 'object',
    required: ['brands'],
    additionalProperties: false,
    properties: {
      brands: {
        type: 'array',
        items: { type: 'string', format: 'uuid' },
        description: 'Full list of Brand UUIDs (from GET /brands) carried by this store. All IDs must exist and be active.',
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            brands: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
    401: unauthorized,
    404: notFound,
  },
};

// ─── GET /stores/my — vendor fetches own store ────────────────────────────────

export const getMyStoreSchema: FastifySchema = {
  tags: ['Stores'],
  summary: 'Get own store (vendor)',
  description: 'Returns the authenticated vendor\'s store including brands and KYC info.',
  security: [{ BearerAuth: [] }],
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { store: storeObjectAdmin } },
      },
    },
    401: unauthorized,
    404: notFound,
  },
};

// ─── DELETE /stores/:storeId ──────────────────────────────────────────────────

export const deleteStoreSchema: FastifySchema = {
  tags: ['Stores'],
  summary: 'Delete a store (admin only)',
  security: [{ BearerAuth: [] }],
  params: {
    type: 'object',
    required: ['storeId'],
    properties: { storeId: { type: 'string', format: 'uuid' } },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { message: { type: 'string' } } },
      },
    },
    401: unauthorized,
    404: notFound,
  },
};

// ─── GET /stores/:storeId/products/:productId ─────────────────────────────────

export const getProductSchema: FastifySchema = {
  tags: ['Stores'],
  summary: 'Get product detail with variants and images',
  params: {
    type: 'object',
    required: ['storeId', 'productId'],
    properties: {
      storeId: { type: 'string', format: 'uuid' },
      productId: { type: 'string' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { product: productObject } },
      },
    },
    401: unauthorized,
    404: notFound,
  },
};
export const toggleActiveSchema: FastifySchema = {
  tags: ['Stores'],
  summary: 'Toggle store active status (Admin)',
  description: 'Actives or deactives a store for public visibility.',
  params: {
    type: 'object',
    required: ['storeId'],
    properties: {
      storeId: { type: 'string', format: 'uuid' },
    },
  },
  body: {
    type: 'object',
    required: ['isActive'],
    properties: {
      isActive: { type: 'boolean' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            store: storeObject,
          },
        },
      },
    },
    401: unauthorized,
    404: notFound,
  },
};


// ─── GET /stores/categories/explorer ─────────────────────────────────────────

export const listStoreCategoryExplorerSchema: FastifySchema = {
  tags: ['Stores'],
  summary: 'Browse all categories with subcategories (mega-menu)',
  description:
    'Returns every category that has at least one matching store, with its subcategories nested inside. ' +
    'Use `city` to scope results to a specific market and `gender` / `categoryType` to narrow the selection. ' +
    'Each category includes a `storeCount` showing how many stores carry it.',
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      categoryType: {
        type: 'string',
        description: 'Filter to stores that carry this category type (e.g. "clothing", "footwear")',
      },
      city: {
        type: 'string',
        description: 'Only include categories available in this city',
      },
      isActive: {
        type: 'boolean',
        default: true,
        description: 'Filter stores by active status (default: true)',
      },
      gender: {
        type: 'string',
        enum: ['men', 'women', 'kids', 'unisex'],
        description: 'Only include categories from stores that serve this gender section',
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            categories: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  name: { type: 'string' },
                  description: { type: ['string', 'null'] },
                  isActive: { type: 'boolean' },
                  storeCount: { type: 'number', description: 'Number of active stores in this category' },
                  subCategories: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string', format: 'uuid' },
                        name: { type: 'string' },
                        isActive: { type: 'boolean' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

// ─── GET /stores/my/brands ───────────────────────────────────────────────────

export const getMyBrandsSchema: FastifySchema = {
  tags: ['Stores'],
  summary: 'Get own store brands (vendor)',
  description: "Returns full brand details for all brands assigned to the authenticated vendor's store.",
  security: [{ BearerAuth: [] }],
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            brands: { type: 'array', items: brandObject },
          },
        },
      },
    },
    401: unauthorized,
    404: notFound,
  },
};

// ─── GET /stores/my/products ─────────────────────────────────────────────────

export const getMyProductsSchema: FastifySchema = {
  tags: ['Stores'],
  summary: 'List own store products (vendor)',
  description: "Returns paginated products for the authenticated vendor's store. Filter by active status, stock status, category, subcategory, or search term.",
  security: [{ BearerAuth: [] }],
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      isActive: { type: 'boolean', description: 'Filter by active/inactive status' },
      stockStatus: {
        type: 'string',
        enum: ['in_stock', 'out_of_stock', 'low_stock'],
        description: 'Filter by stock status',
      },
      categoryId: { type: 'string', format: 'uuid', description: 'Filter by category ID' },
      subCategoryId: { type: 'string', format: 'uuid', description: 'Filter by subcategory ID' },
      search: { type: 'string', description: 'Search by product name or brand' },
      page: { type: 'number', minimum: 1, default: 1 },
      limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            products: { type: 'array', items: productObject },
            total: { type: 'number' },
            page: { type: 'number' },
            limit: { type: 'number' },
          },
        },
      },
    },
    401: unauthorized,
    404: notFound,
  },
};

// ─── GET /stores/:storeId/attributes ─────────────────────────────────────────

export const getStoreAttributesSchema: FastifySchema = {
  tags: ['Stores'],
  summary: 'Get unique colors and sizes for a store',
  description:
    'Returns all distinct colorName/colorHex pairs and size values from active products in the given store. ' +
    'Use this to populate filter UI (color swatches, size pills).',
  params: {
    type: 'object',
    required: ['storeId'],
    properties: { storeId: { type: 'string', format: 'uuid' } },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            colors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  colorName: { type: 'string' },
                  colorHex: { type: ['string', 'null'] },
                },
              },
            },
            sizes: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
    404: notFound,
  },
};

// ─── GET /stores/slug/:slug ───────────────────────────────────────────────────

export const getStoreBySlugSchema: FastifySchema = {
  tags: ['Stores'],
  summary: 'Get store by slug',
  description: 'Fetch a single active store by its URL-friendly slug.',
  params: {
    type: 'object',
    required: ['slug'],
    properties: { slug: { type: 'string', description: 'URL-friendly store slug' } },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { store: storeObject } },
      },
    },
    404: notFound,
  },
};
