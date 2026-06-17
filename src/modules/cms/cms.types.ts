export const CMS_AUDIENCE_TYPES = ['user', 'vendor', 'admin', 'all'] as const;

export type CmsAudienceType = (typeof CMS_AUDIENCE_TYPES)[number];

export interface CreateCmsPageInput {
  slug: string;
  title: string;
  audienceType: CmsAudienceType;
  contentHtml: string;
  isPublished?: boolean;
}

export interface UpdateCmsPageInput {
  slug?: string;
  title?: string;
  audienceType?: CmsAudienceType;
  contentHtml?: string;
  isPublished?: boolean;
}

export interface CmsListFilters {
  slug?: string;
  type?: CmsAudienceType;
  isPublished?: boolean;
  page?: number;
  limit?: number;
}

export interface CmsReadFilters {
  slug?: string;
  type?: CmsAudienceType;
}
