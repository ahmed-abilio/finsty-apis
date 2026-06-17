import sanitizeHtml from 'sanitize-html';

/** Reject expression(), javascript:, @import, and legacy IE behavior in CSS values */
const SAFE_CSS_VALUE =
  /^(?!.*(?:expression\s*\(|javascript:|vbscript:|@import|behavior\s*:))[\s\w#%.,()\-+/:'"!]*$/i;

const ALLOWED_STYLE_PROPERTIES = [
  'color',
  'background',
  'background-color',
  'background-image',
  'font-size',
  'font-weight',
  'font-family',
  'font-style',
  'text-align',
  'text-decoration',
  'line-height',
  'letter-spacing',
  'border',
  'border-radius',
  'border-width',
  'border-color',
  'border-style',
  'padding',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'margin',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'display',
  'flex',
  'flex-direction',
  'flex-wrap',
  'align-items',
  'align-self',
  'justify-content',
  'gap',
  'row-gap',
  'column-gap',
  'width',
  'height',
  'min-width',
  'min-height',
  'max-width',
  'max-height',
  'box-sizing',
  'box-shadow',
  'overflow',
  'overflow-x',
  'overflow-y',
  'opacity',
  'vertical-align',
  'white-space',
  'word-break',
  'object-fit',
  'position',
  'top',
  'left',
  'right',
  'bottom',
  'z-index',
  'transform',
  'border-collapse',
] as const;

function buildAllowedStylesForTag(): Record<string, RegExp[]> {
  const styles: Record<string, RegExp[]> = {};
  for (const prop of ALLOWED_STYLE_PROPERTIES) {
    styles[prop] = [SAFE_CSS_VALUE];
  }
  return styles;
}

const CMS_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'p',
    'br',
    'hr',
    'ul',
    'ol',
    'li',
    'a',
    'strong',
    'em',
    'b',
    'i',
    'u',
    'blockquote',
    'pre',
    'code',
    'table',
    'thead',
    'tbody',
    'tfoot',
    'tr',
    'th',
    'td',
    'colgroup',
    'col',
    'caption',
    'img',
    'span',
    'div',
    'section',
    'article',
    'aside',
    'header',
    'footer',
    'main',
    'figure',
    'figcaption',
    'picture',
    'source',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel', 'class', 'style'],
    img: ['src', 'alt', 'title', 'width', 'height', 'class', 'style'],
    td: ['colspan', 'rowspan', 'class', 'style'],
    th: ['colspan', 'rowspan', 'class', 'style'],
    col: ['span', 'class', 'style'],
    '*': ['class', 'style', 'id', 'role', 'aria-label', 'aria-hidden'],
  },
  allowedStyles: {
    '*': buildAllowedStylesForTag(),
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: {
    img: ['http', 'https', 'data'],
  },
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }),
  },
};

export const CMS_CONTENT_MAX_LENGTH = 500_000;

export function sanitizeCmsHtml(html: string): string {
  return sanitizeHtml(html, CMS_SANITIZE_OPTIONS);
}
