import type { FastifySchema } from 'fastify';

import { validationErrorResponse } from '@utils/sharedSchemas';

// ─── Shared error response shapes ─────────────────────────────────────────────

const unauthorized = {
  type: 'object',
  description: 'Missing or invalid JWT',
  properties: {
    success: { type: 'boolean' },
    error: {
      type: 'object',
      properties: { code: { type: 'string' }, message: { type: 'string' } },
    },
  },
} as const;

const forbidden = {
  type: 'object',
  description: 'Authenticated but not the store owner or an admin',
  properties: {
    success: { type: 'boolean' },
    error: {
      type: 'object',
      properties: { code: { type: 'string' }, message: { type: 'string' } },
    },
  },
} as const;

const notFound = {
  type: 'object',
  description: 'Resource not found',
  properties: {
    success: { type: 'boolean' },
    error: {
      type: 'object',
      properties: { code: { type: 'string' }, message: { type: 'string' } },
    },
  },
} as const;

const conflict = {
  type: 'object',
  description: 'Conflict — e.g. duplicate SKU',
  properties: {
    success: { type: 'boolean' },
    error: {
      type: 'object',
      properties: { code: { type: 'string' }, message: { type: 'string' } },
    },
  },
} as const;

// ─── Reusable domain response objects ─────────────────────────────────────────
const categoryObject = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string' },
    description: { type: 'string', nullable: true },
    isActive: { type: 'boolean' },
    createdAt: { type: 'string', nullable: true },
    updatedAt: { type: 'string', nullable: true },
  },
} as const;

const brandObject = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string' },
    logo: { type: ['string', 'null'] },
    isActive: { type: 'boolean' },
    createdAt: { type: ['string', 'null'] },
    updatedAt: { type: ['string', 'null'] },
  },
} as const;

const colorImageObject = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    colorId: { type: 'string', format: 'uuid' },
    imageUrl: { type: 'string', format: 'uri' },
    altText: { type: 'string', nullable: true },
    displayOrder: { type: 'number' },
    createdAt: { type: 'string', nullable: true },
    updatedAt: { type: 'string', nullable: true },
  },
} as const;

const variantObject = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    productId: { type: 'string', format: 'uuid' },
    colorId: { type: 'string', format: 'uuid' },
    size: { type: 'string', nullable: true },
    sizeChart: { type: 'string', nullable: true, description: 'Size chart image URL when set' },
    sku: { type: 'string', nullable: true },
    stock: { type: 'number' },
    additionalPrice: { type: 'number' },
    label: { type: 'string' },
    createdAt: { type: 'string', nullable: true },
    updatedAt: { type: 'string', nullable: true },
  },
} as const;

const colorObject = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    productId: { type: 'string', format: 'uuid' },
    colorName: { type: 'string' },
    colorHex: { type: 'string', nullable: true },
    images: { type: 'array', items: colorImageObject },
    variants: { type: 'array', items: variantObject },
    createdAt: { type: 'string', nullable: true },
    updatedAt: { type: 'string', nullable: true },
  },
} as const;

const imageObject = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    productId: { type: 'string', format: 'uuid' },
    url: { type: 'string', format: 'uri' },
    position: { type: 'number' },
  },
} as const;

const productObject = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    storeId: { type: 'string', format: 'uuid' },
    name: { type: 'string' },
    slug: { type: 'string' },
    description: { type: 'string', nullable: true },
    brand: {
      oneOf: [
        { type: 'string', format: 'uuid' },
        brandObject,
        { type: 'null' }
      ]
    },
    gender: { type: 'string', nullable: true },
    categoryType: { type: 'string', nullable: true },
    categoryId: { type: 'string', format: 'uuid', nullable: true },
    subCategoryId: { type: 'string', format: 'uuid', nullable: true },
    basePrice: { type: 'number' },
    discountPercent: { type: 'number' },
    discountStartDate: { type: 'string', nullable: true, format: 'date-time' },
    discountEndDate: { type: 'string', nullable: true, format: 'date-time' },
    finalPrice: { type: 'number' },
    isActive: { type: 'boolean' },
    inStock: { type: 'boolean' },
    lowStockThreshold: { type: 'number' },
    lowStockAlert: { type: 'boolean' },
    averageRating: { type: 'number', description: 'Cached average of all approved ratings (0–5)' },
    reviewCount: { type: 'number', description: 'Total number of approved reviews' },
    status: { type: 'string', enum: ['draft', 'active'] },
    createdAt: { type: 'string', nullable: true },
    updatedAt: { type: 'string', nullable: true },
    images: { type: 'array', items: imageObject },
    colors: { type: 'array', items: colorObject },
    category: { ...categoryObject, type: ['object', 'null'] },
    subCategory: { ...categoryObject, type: ['object', 'null'] },
    isWishlisted: { type: 'boolean', description: 'True if the current user has this product in their wishlist' },
  },
} as const;

// ─── Reusable input fragments ─────────────────────────────────────────────────

/** AJV `format: uri` rejects empty strings and some valid S3 URLs — use explicit anyOf instead. */
const optionalMediaUrlInput = {
  description:
    'Optional media reference: HTTPS `publicUrl` from presigned upload, S3 `key` (`uploads/...`), ' +
    'or omit/null/empty when not set.',
  anyOf: [
    { type: 'null' },
    { type: 'string', maxLength: 0 },
    { type: 'string', minLength: 1, pattern: '^https?://\\S+$' },
    { type: 'string', minLength: 1, pattern: '^uploads/[\\w./%-]+$' },
  ],
} as const;

const colorImageInputObject = {
  type: 'object',
  required: ['imageUrl'],
  properties: {
    imageUrl: { type: 'string', format: 'uri', description: 'S3 URL for the colour image' },
    altText: { type: 'string', maxLength: 255 },
    displayOrder: { type: 'number', minimum: 0, description: 'Sort order — ascending. Defaults to array index.' },
  },
} as const;

const variantInputProperties = {
  size: { type: 'string', maxLength: 20, description: 'e.g. S, M, L, XL, 42' },
  sizeChart: optionalMediaUrlInput,
  sku: { type: 'string', maxLength: 100, description: 'Stock-keeping unit — must be unique per product' },
  stock: { type: 'number', minimum: 0 },
  additionalPrice: { type: 'number', minimum: 0, description: 'Price delta added on top of the base product price' },
} as const;

const colorInputProperties = {
  colorName: { type: 'string', maxLength: 50, description: 'Human-readable colour name, e.g. "Midnight Blue"' },
  colorHex: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$', description: 'Hex colour code e.g. #1A2B3C' },
  images: {
    type: 'array',
    description: 'Photos for this colourway — shared across all sizes automatically.',
    items: colorImageInputObject,
  },
  variants: {
    type: 'array',
    description: 'Size variants (SKUs) under this colour.',
    items: { type: 'object', properties: variantInputProperties },
  },
} as const;

// ─── POST /products ───────────────────────────────────────────────────────────

export const createProductSchema: FastifySchema = {
  tags: ['Products'],
  summary: 'Create a product',
  description:
    'Creates a new product under the vendor\'s store. ' +
    'Optionally accepts product-level images and colour groups. ' +
    'Each colour group holds its own images (shared across sizes) and size variants (SKUs). ' +
    'The caller must be the store owner or an admin.',
  security: [{ BearerAuth: [] }],
  body: {
    type: 'object',
    description: `For drafts, only name is needed. storeId is auto-resolved from the vendor's store. When creating as active, name, basePrice, and storeId (for admins) are validated in the service layer.`,
    properties: {
      storeId: { type: 'string', format: 'uuid' },
      name: { type: 'string', minLength: 1, maxLength: 255 },
      description: { type: 'string' },
      brand: { type: 'string', maxLength: 100 },
      gender: { anyOf: [{ type: 'string', enum: ['men', 'women', 'kids', 'unisex'] }, { type: 'string', maxLength: 0 }] },
      categoryType: { type: 'string' },
      categoryId: { anyOf: [{ type: 'string', format: 'uuid' }, { type: 'string', maxLength: 0 }] },
      subCategoryId: { anyOf: [{ type: 'string', format: 'uuid' }, { type: 'string', maxLength: 0 }] },
      basePrice: { type: 'number', minimum: 0 },
      discountPercent: { type: 'number', minimum: 0, maximum: 100, default: 0 },
      discountStartDate: { type: 'string', format: 'date-time', nullable: true },
      discountEndDate: { type: 'string', format: 'date-time', nullable: true },
      lowStockThreshold: { type: 'number', minimum: 0 },
      lowStockAlert: { type: 'boolean' },
      status: { type: 'string', enum: ['draft', 'active'] },
      images: {
        type: 'array',
        description: 'Product-level images (e.g. banner, lifestyle shots). Ordered by `position`.',
        items: {
          type: 'object',
          required: ['url'],
          properties: {
            url: { type: 'string', format: 'uri' },
            position: { type: 'number', minimum: 0, default: 0 },
          },
        },
      },
      colors: {
        type: 'array',
        description: 'Colour groups. Each colour holds its own images and size variants.',
        items: {
          type: 'object',
          required: ['colorName'],
          properties: colorInputProperties,
        },
      },
    },
    additionalProperties: false,
  },
  response: {
    201: {
      description: 'Product created',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { product: productObject } },
      },
    },
    401: unauthorized,
    403: forbidden,
    404: notFound,
  },
};

// ─── GET /products/:productId ─────────────────────────────────────────────────

export const getProductSchema: FastifySchema = {
  tags: ['Products'],
  summary: 'Get a product by ID (public)',
  description: 'Returns the full product record including product images, colours, colour images, and size variants.',
  params: {
    type: 'object',
    required: ['productId'],
    properties: { productId: { type: 'string', format: 'uuid' } },
  },
  response: {
    200: {
      description: 'Product detail',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { product: productObject } },
      },
    },
    404: notFound,
  },
};

// ─── PATCH /products/:productId ───────────────────────────────────────────────

export const updateProductSchema: FastifySchema = {
  tags: ['Products'],
  summary: 'Update a product',
  description: 'Partially updates top-level product fields. Use colour/variant sub-routes to manage colours and SKUs.',
  security: [{ BearerAuth: [] }],
  params: {
    type: 'object',
    required: ['productId'],
    properties: { productId: { type: 'string', format: 'uuid' } },
  },
  body: {
    type: 'object',
    minProperties: 1,
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 255 },
      description: { type: 'string' },
      brand: { type: 'string', maxLength: 100 },
      gender: { type: 'string', enum: ['men', 'women', 'kids', 'unisex'] },
      categoryType: { type: 'string' },
      categoryId: { type: 'string', format: 'uuid' },
      subCategoryId: { type: 'string', format: 'uuid' },
      basePrice: { type: 'number', minimum: 0 },
      discountPercent: { type: 'number', minimum: 0, maximum: 100 },
      discountStartDate: { type: 'string', format: 'date-time' },
      discountEndDate: { type: 'string', format: 'date-time' },
      isActive: { type: 'boolean' },
      inStock: { type: 'boolean' },
      lowStockThreshold: { type: 'number', minimum: 0 },
      lowStockAlert: { type: 'boolean' },
      status: { type: 'string', enum: ['draft', 'active'] },
    },
    additionalProperties: false,
  },
  response: {
    200: {
      description: 'Updated product',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { product: productObject } },
      },
    },
    401: unauthorized,
    403: forbidden,
    404: notFound,
  },
};

// ─── PUT /products/:productId ────────────────────────────────────────────────

export const fullUpdateProductSchema: FastifySchema = {
  tags: ['Products'],
  summary: 'Full product update (BulkSync)',
  description:
    'Performs a complete update of the product data. ' +
    'Replaces the existing images and colour/variant hierarchy with the provided list. ' +
    'Used for comprehensive "Edit Product" forms where all details are saved at once.',
  security: [{ BearerAuth: [] }],
  params: {
    type: 'object',
    required: ['productId'],
    properties: { productId: { type: 'string', format: 'uuid' } },
  },
  body: {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 255 },
      description: { type: 'string' },
      brand: { type: 'string', maxLength: 100 },
      gender: { anyOf: [{ type: 'string', enum: ['men', 'women', 'kids', 'unisex'] }, { type: 'string', maxLength: 0 }] },
      categoryType: { type: 'string' },
      categoryId: { anyOf: [{ type: 'string', format: 'uuid' }, { type: 'string', maxLength: 0 }] },
      subCategoryId: { anyOf: [{ type: 'string', format: 'uuid' }, { type: 'string', maxLength: 0 }] },
      basePrice: { type: 'number', minimum: 0 },
      discountPercent: { type: 'number', minimum: 0, maximum: 100, default: 0 },
      discountStartDate: { type: 'string', format: 'date-time', nullable: true },
      discountEndDate: { type: 'string', format: 'date-time', nullable: true },
      isActive: { type: 'boolean' },
      inStock: { type: 'boolean' },
      lowStockThreshold: { type: 'number', minimum: 0 },
      lowStockAlert: { type: 'boolean' },
      images: {
        type: 'array',
        items: {
          type: 'object',
          required: ['url'],
          properties: {
            url: { type: 'string', format: 'uri' },
            position: { type: 'number', minimum: 0, default: 0 },
          },
        },
      },
      colors: {
        type: 'array',
        items: {
          type: 'object',
          required: ['colorName'],
          properties: colorInputProperties,
        },
      },
    },
    additionalProperties: false,
  },
  response: {
    200: {
      description: 'Product updated',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { product: productObject } },
      },
    },
    401: unauthorized,
    403: forbidden,
    404: notFound,
  },
};

// ─── DELETE /products/:productId ──────────────────────────────────────────────

export const deleteProductSchema: FastifySchema = {
  tags: ['Products'],
  summary: 'Delete a product',
  description: 'Soft-delete by default (`isActive = false`). Pass `?hard=true` as admin to permanently destroy.',
  security: [{ BearerAuth: [] }],
  params: {
    type: 'object',
    required: ['productId'],
    properties: { productId: { type: 'string', format: 'uuid' } },
  },
  querystring: {
    type: 'object',
    properties: {
      hard: { type: 'boolean', default: false, description: 'Admin only — permanently delete the record and all related data' },
    },
  },
  response: {
    200: {
      description: 'Product deleted',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { message: { type: 'string' } } },
      },
    },
    401: unauthorized,
    403: forbidden,
    404: notFound,
  },
};

// ─── POST /products/:productId/images ─────────────────────────────────────────

export const addImageSchema: FastifySchema = {
  tags: ['Products'],
  summary: 'Add a product-level image',
  description: 'Attaches an S3 image URL to the product itself (e.g. banner, lifestyle shot). For colour-specific photos use the colour image sub-route.',
  security: [{ BearerAuth: [] }],
  params: {
    type: 'object',
    required: ['productId'],
    properties: { productId: { type: 'string', format: 'uuid' } },
  },
  body: {
    type: 'object',
    required: ['url'],
    properties: {
      url: { type: 'string', format: 'uri' },
      position: { type: 'number', minimum: 0, default: 0 },
    },
    additionalProperties: false,
  },
  response: {
    201: {
      description: 'Image added',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { image: imageObject } },
      },
    },
    401: unauthorized,
    403: forbidden,
    404: notFound,
  },
};

// ─── DELETE /products/:productId/images/:imageId ──────────────────────────────

export const deleteImageSchema: FastifySchema = {
  tags: ['Products'],
  summary: 'Delete a product-level image',
  security: [{ BearerAuth: [] }],
  params: {
    type: 'object',
    required: ['productId', 'imageId'],
    properties: {
      productId: { type: 'string', format: 'uuid' },
      imageId: { type: 'string', format: 'uuid' },
    },
  },
  response: {
    200: {
      description: 'Image deleted',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { message: { type: 'string' } } },
      },
    },
    401: unauthorized,
    403: forbidden,
    404: notFound,
  },
};

// ─── POST /products/:productId/colors ─────────────────────────────────────────

export const addColorSchema: FastifySchema = {
  tags: ['Products'],
  summary: 'Add a colour group to a product',
  description: 'Creates a new colour (style/colourway) under a product. Optionally supply images and size variants in the same request.',
  security: [{ BearerAuth: [] }],
  params: {
    type: 'object',
    required: ['productId'],
    properties: { productId: { type: 'string', format: 'uuid' } },
  },
  body: {
    type: 'object',
    required: ['colorName'],
    properties: colorInputProperties,
    additionalProperties: false,
  },
  response: {
    201: {
      description: 'Colour created',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { color: colorObject } },
      },
    },
    401: unauthorized,
    403: forbidden,
    404: notFound,
  },
};

// ─── PATCH /products/:productId/colors/:colorId ───────────────────────────────

export const updateColorSchema: FastifySchema = {
  tags: ['Products'],
  summary: 'Update a colour group',
  description: 'Updates the colorName and/or colorHex of a colour group. Use the colour image/variant sub-routes to manage their contents.',
  security: [{ BearerAuth: [] }],
  params: {
    type: 'object',
    required: ['productId', 'colorId'],
    properties: {
      productId: { type: 'string', format: 'uuid' },
      colorId: { type: 'string', format: 'uuid' },
    },
  },
  body: {
    type: 'object',
    minProperties: 1,
    properties: {
      colorName: { type: 'string', maxLength: 50 },
      colorHex: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
    },
    additionalProperties: false,
  },
  response: {
    200: {
      description: 'Updated colour',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { color: colorObject } },
      },
    },
    401: unauthorized,
    403: forbidden,
    404: notFound,
  },
};

// ─── DELETE /products/:productId/colors/:colorId ──────────────────────────────

export const deleteColorSchema: FastifySchema = {
  tags: ['Products'],
  summary: 'Delete a colour group',
  description: 'Permanently removes the colour and all its associated images and size variants (CASCADE).',
  security: [{ BearerAuth: [] }],
  params: {
    type: 'object',
    required: ['productId', 'colorId'],
    properties: {
      productId: { type: 'string', format: 'uuid' },
      colorId: { type: 'string', format: 'uuid' },
    },
  },
  response: {
    200: {
      description: 'Colour deleted',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { message: { type: 'string' } } },
      },
    },
    401: unauthorized,
    403: forbidden,
    404: notFound,
  },
};

// ─── POST /products/:productId/colors/:colorId/images ────────────────────────

export const addColorImageSchema: FastifySchema = {
  tags: ['Products'],
  summary: 'Add an image to a colour group',
  description: 'Attaches an S3 image to a specific colour. The image is shared across all size variants of that colour.',
  security: [{ BearerAuth: [] }],
  params: {
    type: 'object',
    required: ['productId', 'colorId'],
    properties: {
      productId: { type: 'string', format: 'uuid' },
      colorId: { type: 'string', format: 'uuid' },
    },
  },
  body: {
    type: 'object',
    required: ['imageUrl'],
    properties: {
      imageUrl: { type: 'string', format: 'uri' },
      altText: { type: 'string', maxLength: 255 },
      displayOrder: { type: 'number', minimum: 0, default: 0 },
    },
    additionalProperties: false,
  },
  response: {
    201: {
      description: 'Image added',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { image: colorImageObject } },
      },
    },
    401: unauthorized,
    403: forbidden,
    404: notFound,
  },
};

// ─── DELETE /products/:productId/colors/:colorId/images/:imageId ─────────────

export const deleteColorImageSchema: FastifySchema = {
  tags: ['Products'],
  summary: 'Delete a colour image',
  security: [{ BearerAuth: [] }],
  params: {
    type: 'object',
    required: ['productId', 'colorId', 'imageId'],
    properties: {
      productId: { type: 'string', format: 'uuid' },
      colorId: { type: 'string', format: 'uuid' },
      imageId: { type: 'string', format: 'uuid' },
    },
  },
  response: {
    200: {
      description: 'Image deleted',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { message: { type: 'string' } } },
      },
    },
    401: unauthorized,
    403: forbidden,
    404: notFound,
  },
};

// ─── POST /products/:productId/colors/:colorId/variants ──────────────────────

export const addVariantSchema: FastifySchema = {
  tags: ['Products'],
  summary: 'Add a size variant (SKU) to a colour',
  description: 'Creates a new size variant under a specific colour group. The `sku` must be unique within the product.',
  security: [{ BearerAuth: [] }],
  params: {
    type: 'object',
    required: ['productId', 'colorId'],
    properties: {
      productId: { type: 'string', format: 'uuid' },
      colorId: { type: 'string', format: 'uuid' },
    },
  },
  body: {
    type: 'object',
    properties: variantInputProperties,
    additionalProperties: false,
  },
  response: {
    201: {
      description: 'Variant created',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { variant: variantObject } },
      },
    },
    401: unauthorized,
    403: forbidden,
    404: notFound,
    409: conflict,
  },
};

// ─── PATCH /products/:productId/colors/:colorId/variants/:variantId ──────────

export const updateVariantSchema: FastifySchema = {
  tags: ['Products'],
  summary: 'Update a size variant',
  description: 'Partially updates a size variant. Changing `sku` is checked for uniqueness within the product.',
  security: [{ BearerAuth: [] }],
  params: {
    type: 'object',
    required: ['productId', 'colorId', 'variantId'],
    properties: {
      productId: { type: 'string', format: 'uuid' },
      colorId: { type: 'string', format: 'uuid' },
      variantId: { type: 'string', format: 'uuid' },
    },
  },
  body: {
    type: 'object',
    minProperties: 1,
    properties: variantInputProperties,
    additionalProperties: false,
  },
  response: {
    200: {
      description: 'Updated variant',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { variant: variantObject } },
      },
    },
    401: unauthorized,
    403: forbidden,
    404: notFound,
    409: conflict,
  },
};

// ─── GET /products (public listing) ──────────────────────────────────────────

const paginationMeta = {
  type: 'object',
  properties: {
    total: { type: 'number' },
    page: { type: 'number' },
    limit: { type: 'number' },
    totalPages: { type: 'number' },
  },
} as const;

// Listing response omits colors/variants to keep payload light; use GET /:id for full detail
const productSummaryObject = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    storeId: { type: 'string', format: 'uuid' },
    name: { type: 'string' },
    description: { type: 'string', nullable: true },
    brand: {
      oneOf: [
        { type: 'string', format: 'uuid' },
        brandObject,
        { type: 'null' }
      ]
    },
    gender: { type: 'string', nullable: true },
    categoryType: { type: 'string', nullable: true },
    categoryId: { type: 'string', format: 'uuid', nullable: true },
    subCategoryId: { type: 'string', format: 'uuid', nullable: true },
    basePrice: { type: 'number' },
    discountPercent: { type: 'number' },
    discountStartDate: {
      type: 'string',
      nullable: true,
      format: 'date-time',
      description: 'Discount valid from (ISO 8601). Null if no start bound.',
    },
    discountEndDate: {
      type: 'string',
      nullable: true,
      format: 'date-time',
      description: 'Discount valid until (ISO 8601). Null if no end bound.',
    },
    finalPrice: { type: 'number' },
    isActive: { type: 'boolean' },
    inStock: { type: 'boolean' },
    averageRating: { type: 'number' },
    reviewCount: { type: 'number' },
    status: { type: 'string', enum: ['draft', 'active'] },
    createdAt: { type: 'string', nullable: true },
    images: { type: 'array', items: imageObject },
    category: { ...categoryObject, type: ['object', 'null'] },
    subCategory: { ...categoryObject, type: ['object', 'null'] },
    isWishlisted: { type: 'boolean' },
  },
} as const;

export const listProductsSchema: FastifySchema = {
  tags: ['Products'],
  summary: 'List products (public)',
  description:
    'Public paginated product catalogue with filtering and sorting. ' +
    'Returns summary cards — fetch `GET /products/:productId` for the full colour/variant detail.',
  querystring: {
    type: 'object',
    properties: {
      storeIds: {
        type: 'array',
        items: { type: 'string', format: 'uuid' },
        description: 'Filter to one or more stores',
      },
      categoryIds: {
        type: 'array',
        items: { type: 'string', format: 'uuid' },
        description: 'Filter by category',
      },
      minPrice: { type: 'number', minimum: 0, description: 'Minimum base price (inclusive)' },
      maxPrice: { type: 'number', minimum: 0, description: 'Maximum base price (inclusive)' },
      priceUnder: { type: 'number', minimum: 0, description: 'Show products with basePrice ≤ this value (inclusive). Combined with maxPrice by taking the lower bound.' },
      discountUnder: { type: 'number', minimum: 0, maximum: 100, description: 'Show products with discountPercent ≤ this value (inclusive). E.g. 10 returns products discounted 0–10%.' },
      genders: {
        type: 'array',
        items: { type: 'string', enum: ['men', 'women', 'kids', 'unisex'] },
      },
      hasDiscount: { type: 'boolean', description: 'Only return products with an active discount percent > 0' },
      brands: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Filter by brand name (e.g. `brands=Nike`) or brand UUID. Single values are coerced to a one-element array.',
      },
      colors: {
        type: 'array',
        items: { type: 'string' },
        description: 'Filter by colour name (matches ProductColor.colorName)',
      },
      sizes: {
        type: 'array',
        items: { type: 'string' },
        description: 'Filter by size (matches ProductVariant.size, e.g. ["S", "XL"])',
      },
      minRating: { type: 'number', minimum: 0, maximum: 5, description: 'Minimum averageRating (inclusive)' },
      sortBy: {
        type: 'string',
        enum: ['price_asc', 'price_desc', 'newest', 'rating', 'discount_desc', 'relevance'],
        default: 'newest',
      },
      lat: { type: 'number', minimum: -90, maximum: 90, description: 'User latitude — enables geofence filtering using GEOFENCE_RADIUS_KM env var' },
      lng: { type: 'number', minimum: -180, maximum: 180, description: 'User longitude — enables geofence filtering using GEOFENCE_RADIUS_KM env var' },
      page: { type: 'number', minimum: 1, default: 1 },
      limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
      search: { type: 'string', description: 'Search by product name' },
    },
  },
  response: {
    200: {
      description: 'Paginated product list',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            items: { type: 'array', items: productSummaryObject },
            pagination: paginationMeta,
          },
        },
      },
    },
  },
};

// ─── GET /products/brands ─────────────────────────────────────────────────────

export const listBrandsSchema: FastifySchema = {
  tags: ['Products'],
  summary: 'List all brand names (App Users Only)',
  description:
    'Returns all active brand names from the master Brand table. ' +
    'Requires authentication as it is intended for app users. ' +
    'Prefer using `GET /brands` for full brand objects including logos.',
  security: [{ BearerAuth: [] }],
  querystring: {
    type: 'object',
    properties: {
      storeIds: {
        type: 'array',
        items: { type: 'string', format: 'uuid' },
        description: 'Deprecated — no longer scopes brands to specific stores',
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
            brands: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  name: { type: 'string' },
                  isActive: { type: 'boolean' },
                  logo: { type: 'string', nullable: true },
                },
              },
            },
          },
        },
      },
    },
    401: unauthorized,
  },
};

// ─── DELETE /products/:productId/colors/:colorId/variants/:variantId ─────────

export const deleteVariantSchema: FastifySchema = {
  tags: ['Products'],
  summary: 'Delete a size variant',
  security: [{ BearerAuth: [] }],
  params: {
    type: 'object',
    required: ['productId', 'colorId', 'variantId'],
    properties: {
      productId: { type: 'string', format: 'uuid' },
      colorId: { type: 'string', format: 'uuid' },
      variantId: { type: 'string', format: 'uuid' },
    },
  },
  response: {
    200: {
      description: 'Variant deleted',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { message: { type: 'string' } } },
      },
    },
    401: unauthorized,
    403: forbidden,
    404: notFound,
  },
};

// ─── GET /products/slug/:slug ─────────────────────────────────────────────────

export const getProductBySlugSchema: FastifySchema = {
  tags: ['Products'],
  summary: 'Get product by slug',
  description: 'Fetch a single active product by its URL-friendly slug.',
  params: {
    type: 'object',
    required: ['slug'],
    properties: { slug: { type: 'string', description: 'URL-friendly product slug' } },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { product: productObject } },
      },
    },
    404: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error: { type: 'object', properties: { code: { type: 'string' }, message: { type: 'string' } } },
      },
    },
  },
};

// ─── GET /products/drafts ─────────────────────────────────────────────────────

export const listDraftsSchema: FastifySchema = {
  tags: ['Products'],
  summary: 'List draft products (vendor/admin)',
  description:
    'Returns paginated draft products for the authenticated vendor\'s store. ' +
    'Admins can optionally filter by storeId to see any store\'s drafts.',
  security: [{ BearerAuth: [] }],
  querystring: {
    type: 'object',
    properties: {
      storeId: {
        type: 'string',
        format: 'uuid',
        description: 'Admin only — filter by a specific store. Ignored for vendors (their store is used automatically).',
      },
      page: { type: 'number', minimum: 1, default: 1 },
      limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
      search: { type: 'string', description: 'Search by product name' },
    },
  },
  response: {
    200: {
      description: 'Paginated draft list',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            items: { type: 'array', items: productSummaryObject },
            pagination: paginationMeta,
          },
        },
      },
    },
    401: unauthorized,
    403: forbidden,
  },
};

// ─── PATCH /products/:productId/publish ──────────────────────────────────────

export const publishProductSchema: FastifySchema = {
  tags: ['Products'],
  summary: 'Publish a draft product',
  description:
    'Transitions a product from draft to active, making it visible in the public catalogue. ' +
    'Validates that name and basePrice are present before publishing. ' +
    'The caller must be the store owner or an admin.',
  security: [{ BearerAuth: [] }],
  params: {
    type: 'object',
    required: ['productId'],
    properties: { productId: { type: 'string', format: 'uuid' } },
  },
  response: {
    200: {
      description: 'Product published',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', properties: { product: productObject } },
      },
    },
    400: validationErrorResponse,
    401: unauthorized,
    403: forbidden,
    404: notFound,
  },
};
