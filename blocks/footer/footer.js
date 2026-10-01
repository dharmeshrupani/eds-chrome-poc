import { loadFragment } from '../fragment/fragment.js';
import { getChromeFragmentUrl } from '../../scripts/chrome.js';

/**
 * loads and decorates the footer
 * @param {Element} block The footer block element
 */
export default async function decorate(block) {
  const chromeUrl = getChromeFragmentUrl('footer');
  block.dataset.chromeSource = chromeUrl;

  const fragment = await loadFragment(chromeUrl);
  if (!fragment?.firstElementChild) {
    block.dataset.chromeStatus = 'missing';
    return;
  }
  block.dataset.chromeStatus = 'loaded';

  block.textContent = '';
  const footer = document.createElement('div');
  while (fragment.firstElementChild) footer.append(fragment.firstElementChild);

  block.append(footer);
}
