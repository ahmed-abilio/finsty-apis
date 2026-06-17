import { FastifySchema } from 'fastify';

import { validationErrorResponse } from '@utils/sharedSchemas';

// ─── Upload folder enum ───────────────────────────────────────────────────────

export type UploadFolder =
  | 'avatars'      // user profile pictures
  | 'products'     // product listing images
  | 'categories'   // category cover images
  | 'banners'      // promotional / hero banners
  | 'stores'       // vendor / store branding images
  | 'reviews'      // review / feedback images & attachments
  | 'documents';   // invoices, receipts, PDFs, spreadsheets

export const UPLOAD_FOLDERS: UploadFolder[] = [
  'avatars',
  'products',
  'categories',
  'banners',
  'stores',
  'reviews',
  'documents',
];

// ─── MIME type groups ─────────────────────────────────────────────────────────

export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export const DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'application/msword',                                                          // .doc
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',    // .docx
  'application/vnd.ms-excel',                                                   // .xls
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',          // .xlsx
  'text/csv',
] as const;

export type ImageMimeType = (typeof IMAGE_MIME_TYPES)[number];
export type DocumentMimeType = (typeof DOCUMENT_MIME_TYPES)[number];
export type AllowedMimeType = ImageMimeType | DocumentMimeType;

/** Returns the allowed MIME types for a given folder. */
export function getAllowedMimeTypes(folder: UploadFolder): readonly string[] {
  return folder === 'documents'
    ? [...IMAGE_MIME_TYPES, ...DOCUMENT_MIME_TYPES]
    : IMAGE_MIME_TYPES;
}

// ─── GET /media/presigned-upload ──────────────────────────────────────────────

export const presignedUploadSchema: FastifySchema = {
  tags: ['Media'],
  summary: 'Get a presigned S3 URL for file upload',
  description:
    'Returns a short-lived presigned **PUT** URL, the final public file URL, and the S3 key.\n\n' +
    '**Upload flow:**\n' +
    '1. Call this endpoint with `filename`, `mimeType`, and `folder` to get `uploadUrl`, `publicUrl`, and `key`.\n' +
    '2. `PUT` the raw file bytes to `uploadUrl` with the matching `Content-Type` header — no auth needed, credentials are embedded in the URL.\n' +
    '3. Pass `publicUrl` to the relevant resource endpoint (e.g. `PATCH /users/me/avatar`) to persist it.\n\n' +
    '**Allowed MIME types by folder:**\n' +
    '- Image folders (`avatars`, `products`, `categories`, `banners`, `stores`, `reviews`): `image/jpeg`, `image/png`, `image/webp`\n' +
    '- `documents`: all image types + `application/pdf`, `.doc/.docx`, `.xls/.xlsx`, `text/csv`\n\n' +
    'The presigned URL expires after 1 hour (configurable via `S3_PRESIGNED_URL_EXPIRES`).',
  // security: [{ BearerAuth: [] }],
  querystring: {
    type: 'object',
    required: ['filename', 'mimeType', 'folder'],
    properties: {
      filename: {
        type: 'string',
        minLength: 1,
        description: 'Original file name (e.g. `photo.jpg`, `invoice.pdf`). Used to build the S3 key.',
      },
      mimeType: {
        type: 'string',
        enum: [
          // images
          'image/jpeg',
          'image/png',
          'image/webp',
          // documents
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'text/csv',
        ],
        description: [
          'MIME type of the file to upload.',
          '**Images** (all folders): `image/jpeg`, `image/png`, `image/webp`',
          '**Documents** (`documents` folder only): `application/pdf`, `application/msword` (.doc), `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (.docx), `application/vnd.ms-excel` (.xls), `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (.xlsx), `text/csv`',
        ].join('\n'),
      },
      folder: {
        type: 'string',
        enum: ['avatars', 'products', 'categories', 'banners', 'stores', 'reviews', 'documents'],
        description: [
          'Destination folder under `uploads/`:',
          '- `avatars` — user profile pictures (images only)',
          '- `products` — product listing images (images only)',
          '- `categories` — category cover images (images only)',
          '- `banners` — promotional / hero banners (images only)',
          '- `stores` — vendor / store branding images (images only)',
          '- `reviews` — review / feedback images and attachments (images only)',
          '- `documents` — invoices, receipts, PDFs, spreadsheets (images + documents)',
        ].join('\n'),
      },
    },
    additionalProperties: false,
  },
  response: {
    200: {
      description: 'Presigned upload details',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            uploadUrl: {
              type: 'string',
              description: 'Presigned S3 PUT URL — PUT the raw file bytes here with the correct Content-Type.',
            },
            publicUrl: {
              type: 'string',
              description: 'Final public URL of the file after upload. Pass this to resource endpoints.',
            },
            key: {
              type: 'string',
              description: 'S3 object key. Use this for deletion via DELETE /media.',
            },
          },
        },
      },
    },
    400: validationErrorResponse,
    401: {
      description: 'Unauthorized',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error: {
          type: 'object',
          properties: { code: { type: 'string' }, message: { type: 'string' } },
        },
      },
    },
  },
};

// ─── DELETE /media ────────────────────────────────────────────────────────────

export const deleteMediaSchema: FastifySchema = {
  tags: ['Media'],
  summary: 'Delete a file from S3',
  description:
    'Permanently deletes any S3 object (image or document) by its key. ' +
    'The key must belong to the authenticated user — it must contain the user\'s ID in the correct path segment.',
  // security: [{ BearerAuth: [] }],
  body: {
    type: 'object',
    required: ['key'],
    properties: {
      key: {
        type: 'string',
        minLength: 1,
        description: 'S3 object key returned by GET /media/presigned-upload.',
      },
    },
    additionalProperties: false,
  },
  response: {
    200: {
      description: 'File deleted successfully',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: { message: { type: 'string' } },
        },
      },
    },
    400: validationErrorResponse,
    401: {
      description: 'Unauthorized',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error: {
          type: 'object',
          properties: { code: { type: 'string' }, message: { type: 'string' } },
        },
      },
    },
  },
};
