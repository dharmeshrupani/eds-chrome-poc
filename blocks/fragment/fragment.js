/*
 * Fragment Block
 * Include content on a page as a fragment.
 * https://www.aem.live/developer/block-collection/fragment
 */

// eslint-disable-next-line import/no-cycle
import {
  decorateMain,
} from '../../scripts/scripts.js';

import {
  loadSections,
} from '../../scripts/aem.js';

import { isAllowedChromeUrl } from '../../scripts/chrome.js';

/**
 * @param {string} path root-relative path or absolute URL on an allowed host
 * @returns {URL|null}
 */
function fragmentResourceUrl(path) {
  if (!path || typeof path !== 'string') return null;
  const trimmed = path.trim();
  const absolute = /^https?:\/\//i.test(trimmed);
  const rooted = trimmed.startsWith('/') && !trimmed.startsWith('//');
  if (!absolute && !rooted) return null;

  let resource;
  try {
    resource = new URL(trimmed, window.location.href);
  } catch {
    return null;
  }

  if (resource.origin !== window.location.origin && !isAllowedChromeUrl(resource.href)) {
    return null;
  }

  const pathname = resource.pathname.replace(/(\.plain)?\.html$/, '').replace(/\/$/, '') || '/';
  resource.pathname = pathname;
  resource.search = '';
  resource.hash = '';
  return resource;
}

/**
 * @param {string} value
 * @param {URL} base
 * @returns {string}
 */
function rewriteToken(value, base) {
  try {
    return new URL(value, base).href;
  } catch {
    return value;
  }
}

/**
 * @param {string} value
 * @param {URL} base
 * @returns {string}
 */
function rewriteSrcset(value, base) {
  return value.split(',').map((part) => {
    const trimmed = part.trim();
    if (!trimmed) return '';
    const match = trimmed.match(/^(\S+)(\s+.*)?$/);
    if (!match) return trimmed;
    const absolute = rewriteToken(match[1], base);
    return match[2] ? `${absolute}${match[2]}` : absolute;
  }).filter(Boolean).join(', ');
}

/**
 * Point fragment media at the fragment host.
 * Same-origin fragments keep the `./media_` rewrite. Cross-origin chrome also
 * rewrites relative and root-relative media so those assets are not requested
 * from the page that embedded the fragment. Document links are left as authored.
 * @param {HTMLElement} main
 * @param {URL} resource
 */
function rewriteFragmentMedia(main, resource) {
  const crossOrigin = resource.origin !== window.location.origin;

  const needsRewrite = (value) => {
    if (!value) return false;
    const token = value.trim().split(/\s+/)[0];
    if (!token || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(token)) return false;
    if (token.startsWith('./media_')) return true;
    if (!crossOrigin) return false;
    return token.startsWith('/') || token.startsWith('./') || token.startsWith('../');
  };

  main.querySelectorAll('img, source, video').forEach((elem) => {
    ['src', 'srcset', 'poster'].forEach((attr) => {
      const value = elem.getAttribute(attr);
      if (!value) return;
      if (attr === 'srcset') {
        const tokens = value.split(',').map((part) => part.trim().split(/\s+/)[0]);
        if (!tokens.some((token) => needsRewrite(token))) return;
        elem.setAttribute(attr, rewriteSrcset(value, resource));
        return;
      }
      if (!needsRewrite(value)) return;
      elem.setAttribute(attr, rewriteToken(value, resource));
    });
  });
}

/**
 * Loads a fragment.
 * @param {string} path The path to the fragment, or an absolute URL on an allowed host
 * @returns {Promise<HTMLElement|null>} The root element of the fragment
 */
export async function loadFragment(path) {
  const resource = fragmentResourceUrl(path);
  if (!resource) return null;

  const fetchUrl = new URL(resource.href);
  fetchUrl.pathname = `${resource.pathname}.plain.html`;

  try {
    const resp = await fetch(fetchUrl.href);
    if (!resp.ok) return null;

    const main = document.createElement('main');
    main.innerHTML = await resp.text();
    rewriteFragmentMedia(main, resource);

    decorateMain(main);
    await loadSections(main);
    return main;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Fragment loading failed', error);
    return null;
  }
}

export default async function decorate(block) {
  const link = block.querySelector('a');
  const path = link ? link.getAttribute('href') : block.textContent.trim();
  const fragment = await loadFragment(path);
  if (!fragment) return;

  const wrapper = block.closest('.fragment-wrapper');
  const section = wrapper.closest('.section');

  if (section && section.children.length === 1) {
    // fragment is the ONLY child of its section; replace the whole section
    section.replaceWith(...fragment.childNodes);
  } else {
    // fragment shares section with other children; flatten children into it
    fragment.querySelectorAll(':scope > .section').forEach((fragSection) => {
      [...fragSection.childNodes].forEach((child) => wrapper.before(child));
    });
    wrapper.remove();
  }
}
