# CMS (content pages)

HTML content pages scoped by **audience** (`user`, `vendor`, `admin`, `all`) and **slug** (e.g. `terms`, `privacy`, `vendor-help`).

## Authenticated read

`GET /api/v1/cms` — requires Bearer JWT.

| Query | Description |
|-------|-------------|
| `slug` | Optional exact slug |
| `type` | Optional audience: `user`, `vendor`, `admin`, `all` |

**Rules:**

- Only **published** pages are returned.
- If `type` is set: `audience_type IN (type, 'all')`.
- If `type` is omitted: uses JWT `role` with the same rule.

**Examples:**

```http
GET /api/v1/cms?slug=terms&type=user
GET /api/v1/cms?slug=vendor-policy&type=vendor
GET /api/v1/cms?slug=internal-notes&type=admin
```

Response: `{ success, data: { items: CmsPage[] } }`

## Admin CRUD

`GET|POST /api/v1/admin/cms`  
`GET|PATCH|DELETE /api/v1/admin/cms/:id`

Requires `role: admin`.

| Field | Notes |
|-------|--------|
| `slug` | Lowercase, hyphens, 2–128 chars; unique per `(slug, audienceType)` |
| `title` | Display title |
| `audienceType` | `user` \| `vendor` \| `admin` \| `all` |
| `contentHtml` | Rich HTML (sanitized on save; inline `style`, `class`, and safe link attrs preserved) |
| `isPublished` | Default `true` |

Admin list supports `slug`, `type`, `isPublished`, `page`, `limit`.

## Mobile apps

Render `contentHtml` in a WebView. Always send the app’s audience as `type` when fetching a specific page.
