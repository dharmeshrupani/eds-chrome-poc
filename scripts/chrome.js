import { getMetadata } from './aem.js';

/**
 * UE site that owns header and footer fragments.
 *
 * Leave both values empty to load same-origin `/fragments/header` and
 * `/fragments/footer`. On `*.aem.page` / `*.hlx.page` the preview value is
 * used; on `*.aem.live` / `*.hlx.live` the live value is used. Any other host,
 * including localhost, ignores these values.
 *
 * Set them when this codebase should always pull chrome from the UE site:
 * preview `https://main--eds-chrome-poc-ue--dharmeshrupani.aem.page`
 * live `https://main--eds-chrome-poc-ue--dharmeshrupani.aem.live`
 *
 * Origins only (scheme + host [+ port], no path). A per-site
 * `<meta name="chrome-origin">` overrides these constants. See
 * docs/SHARED-CHROME-POC.md.
 */
export const CHROME_ORIGIN = {
  preview: '',
  live: '',
};

/**
 * Fragment paths. Root-relative paths are joined with the resolved chrome
 * origin. Absolute `https://…aem.page` / `aem.live` URLs are used as-is, which
 * is how header and footer can point at different documents if needed.
 * Page metadata `nav` and `footer` override these.
 */
export const CHROME_FRAGMENTS = {
  header: '/fragments/header',
  footer: '/fragments/footer',
};

const PATH_METADATA = {
  header: 'nav',
  footer: 'footer',
};

const EDS_HOST = /\.aem\.(?:page|live)$/i;
const HLX_HOST = /\.hlx\.(?:page|live)$/i;

/**
 * @param {string} value
 * @returns {string} origin or '' when the value is not an allowed chrome host
 */
export function normalizeChromeOrigin(value) {
  if (!value || typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';

  let url;
  try {
    url = new URL(trimmed);
  } catch {
    return '';
  }

  if (url.username || url.password) return '';

  const { hostname, protocol } = url;
  const local = hostname === 'localhost' || hostname === '127.0.0.1';
  const eds = EDS_HOST.test(hostname) || HLX_HOST.test(hostname);
  if (eds && protocol === 'https:') return url.origin;
  if (local && (protocol === 'http:' || protocol === 'https:')) return url.origin;
  return '';
}

/**
 * @param {string} value
 * @returns {boolean}
 */
export function isAllowedChromeUrl(value) {
  return Boolean(normalizeChromeOrigin(value));
}

function readQueryOrigin() {
  const { hostname } = window.location;
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') return '';
  const value = new URLSearchParams(window.location.search).get('chrome-origin');
  return normalizeChromeOrigin(value);
}

function readEnvOrigin() {
  const { hostname } = window.location;
  if (hostname.endsWith('.aem.page') || hostname.endsWith('.hlx.page')) {
    return normalizeChromeOrigin(CHROME_ORIGIN.preview);
  }
  if (hostname.endsWith('.aem.live') || hostname.endsWith('.hlx.live')) {
    return normalizeChromeOrigin(CHROME_ORIGIN.live);
  }
  return '';
}

/**
 * Origin of the site that publishes chrome fragments.
 * Empty means "same origin as the current page".
 * @returns {string}
 */
export function resolveChromeOrigin() {
  return readQueryOrigin()
    || normalizeChromeOrigin(getMetadata('chrome-origin'))
    || readEnvOrigin();
}

/**
 * @param {string} value
 * @param {string} origin
 * @returns {string}
 */
function toFragmentUrl(value, origin) {
  const trimmed = (value || '').trim();
  if (!trimmed) return '';

  if (/^https?:\/\//i.test(trimmed)) {
    if (!normalizeChromeOrigin(trimmed)) return '';
    const url = new URL(trimmed);
    url.pathname = url.pathname.replace(/(\.plain)?\.html$/, '').replace(/\/$/, '') || '/';
    url.search = '';
    url.hash = '';
    return url.href;
  }

  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    const path = trimmed.replace(/(\.plain)?\.html$/, '').replace(/\/$/, '') || '/';
    return origin ? `${origin}${path}` : path;
  }

  return '';
}

/**
 * URL or root-relative path for a chrome fragment.
 * @param {'header'|'footer'} kind
 * @returns {string}
 */
export function getChromeFragmentUrl(kind) {
  const fallback = CHROME_FRAGMENTS[kind] || '';
  const metaName = PATH_METADATA[kind];
  const authored = metaName ? getMetadata(metaName) : '';
  const origin = resolveChromeOrigin();
  return toFragmentUrl(authored, origin) || toFragmentUrl(fallback, origin);
}
