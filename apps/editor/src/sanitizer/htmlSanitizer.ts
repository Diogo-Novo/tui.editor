import DOMPurify from 'dompurify';
import { includes } from '@/utils/common';

const CAN_BE_WHITE_TAG_LIST = ['iframe', 'embed'];
const whiteTagList: string[] = [];

export function registerTagWhitelistIfPossible(tagName: string) {
  if (includes(CAN_BE_WHITE_TAG_LIST, tagName)) {
    whiteTagList.push(tagName.toLowerCase());
  }
}

export function sanitizeHTML<T extends string | HTMLElement | DocumentFragment = string>(
  html: string | Node,
  options?: DOMPurify.Config
) {
  return DOMPurify.sanitize(html, {
    ADD_TAGS: whiteTagList,
    ADD_ATTR: [
      'rel',
      'target',
      'hreflang',
      'type',
      'style',
      'class',
      'id',
      'data-raw-html',
      'align',
    ],
    KEEP_CONTENT: true,
    RETURN_DOM_FRAGMENT: false,
    RETURN_DOM: false,
    FORBID_TAGS: [
      'input',
      'script',
      'textarea',
      'form',
      'button',
      'select',
      'meta',
      'link',
      'object',
      'base',
      'onclick',
      'onload',
      'onerror',
    ],
    ...options,
  }) as T;
}
