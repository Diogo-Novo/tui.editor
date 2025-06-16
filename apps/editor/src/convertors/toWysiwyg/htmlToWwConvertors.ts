import { MdNode } from '@toast-ui/toastmark';
import { sanitizeHTML } from '@/sanitizer/htmlSanitizer';

import {
  HTMLToWwConvertorMap,
  FlattenHTMLToWwConvertorMap,
  ToWwConvertorState,
} from '@t/convertor';
import { includes } from '@/utils/common';
import { reHTMLTag } from '@/utils/constants';

export function getTextWithoutTrailingNewline(text: string) {
  return text[text.length - 1] === '\n' ? text.slice(0, text.length - 1) : text;
}

export function isCustomHTMLInlineNode({ schema }: ToWwConvertorState, node: MdNode) {
  const html = node.literal!;
  const matched = html.match(reHTMLTag);

  if (matched) {
    const [, openTagName, , closeTagName] = matched;
    const typeName = (openTagName || closeTagName).toLowerCase();

    return node.type === 'htmlInline' && !!(schema.marks[typeName] || schema.nodes[typeName]);
  }
  return false;
}

export function isInlineNode({ type }: MdNode) {
  return includes(['text', 'strong', 'emph', 'strike', 'image', 'link', 'code'], type);
}

function isSoftbreak(mdNode: MdNode | null) {
  return mdNode?.type === 'softbreak';
}

function isListNode({ type, literal }: MdNode) {
  const matched = type === 'htmlInline' && literal!.match(reHTMLTag);

  if (matched) {
    const [, openTagName, , closeTagName] = matched;
    const tagName = openTagName || closeTagName;

    if (tagName) {
      return includes(['ul', 'ol', 'li'], tagName.toLowerCase());
    }
  }

  return false;
}

function getListItemAttrs({ literal }: MdNode) {
  const task = /data-task/.test(literal!);
  const checked = /data-task-checked/.test(literal!);

  return { task, checked };
}

function getMatchedAttributeValue(rawHTML: string, ...attrNames: string[]) {
  const wrapper = document.createElement('div');

  wrapper.innerHTML = sanitizeHTML(rawHTML);
  const el = wrapper.firstChild as HTMLElement;

  return attrNames.map((attrName) => {
    if (attrName === 'style' && el.hasAttribute('style')) {
      // Return the raw style attribute
      return el.getAttribute('style');
    }
    return el.getAttribute(attrName) || '';
  });
}

function createConvertors(convertors: HTMLToWwConvertorMap) {
  const convertorMap: FlattenHTMLToWwConvertorMap = {};

  Object.keys(convertors).forEach((key) => {
    const tagNames = key.split(', ');

    tagNames.forEach((tagName) => {
      const name = tagName.toLowerCase();

      // For elements we want to preserve exactly
      if (['div', 'p', 'span'].includes(name)) {
        convertorMap[name] = (state, node, openTagName) => {
          const container = document.createElement('div');

          container.innerHTML = node.literal!;
          const el = container.firstChild as HTMLElement;

          const attrs: Record<string, string | null> = {};

          Array.from(el.attributes).forEach((attr) => {
            attrs[attr.name] = attr.value;
          });

          if (name === 'div') {
            state.openNode(state.schema.nodes.div, {
              ...attrs,
              rawHTML: openTagName,
            });
          } else if (name === 'p') {
            state.openNode(state.schema.nodes.paragraph, {
              ...attrs,
              rawHTML: openTagName,
            });
          }
          // Handle other elements similarly
        };
      } else {
        convertorMap[name] = convertors[key]!;
      }
    });
  });

  return convertorMap;
}

const convertors: HTMLToWwConvertorMap = {
  div: (state, node, openTagName) => {
    const { div } = state.schema.nodes;

    if (openTagName) {
      const container = document.createElement('div');

      container.innerHTML = node.literal!;
      const divEl = container.firstChild as HTMLElement;

      // Clean and combine styles
      const style = divEl.getAttribute('style');
      const cleanedStyle = style
        ? style
            .split(';')
            .filter((val, i, arr) => val.trim() && arr.indexOf(val) === i)
            .join(';')
        : null;

      const attrs = {
        style: cleanedStyle,
        class: divEl.getAttribute('class'),
        rawHTML: openTagName,
      };

      state.openNode(div, attrs);
    } else {
      state.closeNode();
    }
  },

  'b, strong': (state, node, openTagName) => {
    const { strong } = state.schema.marks;
    const container = document.createElement('div');

    container.innerHTML = node.literal!;
    const el = container.firstChild as HTMLElement;

    if (openTagName) {
      state.openMark(
        strong.create({
          rawHTML: openTagName,
          style: el.getAttribute('style'), // Preserve style
        })
      );
    } else {
      state.closeMark(strong);
    }
  },

  // Similarly modify other handlers as needed...

  // Add p handler to preserve attributes
  p: (state, node, openTagName) => {
    const { paragraph } = state.schema.nodes;

    if (openTagName) {
      const container = document.createElement('div');

      container.innerHTML = node.literal!;
      const pEl = container.firstChild as HTMLElement;

      // Clean and combine styles like we did for div
      const style = pEl.getAttribute('style');
      const cleanedStyle = style
        ? style
            .split(';')
            .filter((val, i, arr) => val.trim() && arr.indexOf(val) === i)
            .join(';')
        : null;

      state.openNode(paragraph, {
        style: cleanedStyle,
        class: pEl.getAttribute('class'),
        rawHTML: openTagName,
        preserveWhitespace: true, // Add this flag
      });
    } else {
      state.closeNode();
    }
  },

  'i, em': (state, _, openTagName) => {
    const { emph } = state.schema.marks;

    if (openTagName) {
      state.openMark(emph.create({ rawHTML: openTagName }));
    } else {
      state.closeMark(emph);
    }
  },

  's, del': (state, _, openTagName) => {
    const { strike } = state.schema.marks;

    if (openTagName) {
      state.openMark(strike.create({ rawHTML: openTagName }));
    } else {
      state.closeMark(strike);
    }
  },

  code: (state, _, openTagName) => {
    const { code } = state.schema.marks;

    if (openTagName) {
      state.openMark(code.create({ rawHTML: openTagName }));
    } else {
      state.closeMark(code);
    }
  },

  a: (state, node, openTagName) => {
    const tag = node.literal!;
    const { link } = state.schema.marks;

    if (openTagName) {
      const [linkUrl] = getMatchedAttributeValue(tag, 'href');

      state.openMark(
        link.create({
          linkUrl,
          rawHTML: openTagName,
        })
      );
    } else {
      state.closeMark(link);
    }
  },

  img: (state, node, openTagName) => {
    const tag = node.literal!;

    if (openTagName) {
      const container = document.createElement('div');

      container.innerHTML = tag;
      const imgEl = container.firstChild as HTMLImageElement;

      const attrs: Record<string, string> = {
        src: imgEl.src || '',
        alt: imgEl.alt || '',
        rawHTML: openTagName,
      };

      // Preserve all original attributes including style
      Array.from(imgEl.attributes).forEach((attr) => {
        if (attr.name !== 'src' && attr.name !== 'alt') {
          attrs[attr.name] = attr.value;
        }
      });

      state.addNode(state.schema.nodes.image, attrs);
    }
  },

  hr: (state, _, openTagName) => {
    state.addNode(state.schema.nodes.thematicBreak, { rawHTML: openTagName });
  },

  br: (state, node) => {
    // Simple approach: just add a newline character
    state.addText('\n');

    // Keep the existing logic as fallback for special cases
    const { paragraph } = state.schema.nodes;
    const { parent, prev, next } = node;

    if (parent?.type === 'paragraph') {
      if (isSoftbreak(prev) && isSoftbreak(next)) {
        state.closeNode();
        state.openNode(paragraph);
      }
    }
  },

  pre: (state, node, openTagName) => {
    const container = document.createElement('div');

    container.innerHTML = node.literal!;

    const literal = container.firstChild?.firstChild?.textContent;

    state.openNode(state.schema.nodes.codeBlock, { rawHTML: openTagName });
    state.addText(getTextWithoutTrailingNewline(literal!));
    state.closeNode();
  },

  'ul, ol': (state, node, openTagName) => {
    // in the table cell, '<ul>', '<ol>' is parsed as 'htmlInline' node
    if (node.parent!.type === 'tableCell') {
      const { bulletList, orderedList, paragraph } = state.schema.nodes;
      const list = openTagName === 'ul' ? bulletList : orderedList;

      if (openTagName) {
        if (node.prev && !isListNode(node.prev)) {
          state.closeNode();
        }

        state.openNode(list, { rawHTML: openTagName });
      } else {
        state.closeNode();

        if (node.next && !isListNode(node.next)) {
          state.openNode(paragraph);
        }
      }
    }
  },

  li: (state, node, openTagName) => {
    // in the table cell, '<li>' is parsed as 'htmlInline' node
    if (node.parent?.type === 'tableCell') {
      const { listItem, paragraph } = state.schema.nodes;

      if (openTagName) {
        const attrs = getListItemAttrs(node);

        if (node.prev && !isListNode(node.prev)) {
          state.closeNode();
        }

        state.openNode(listItem, { rawHTML: openTagName, ...attrs });

        if (node.next && !isListNode(node.next)) {
          state.openNode(paragraph);
        }
      } else {
        if (node.prev && !isListNode(node.prev)) {
          state.closeNode();
        }

        state.closeNode();
      }
    }
  },

  span: (state, node, openTagName) => {
    const container = document.createElement('div');

    container.innerHTML = node.literal!;
    const spanEl = container.firstChild as HTMLElement;

    const attrs = {
      style: spanEl.getAttribute('style'),
      class: spanEl.getAttribute('class'),
    };

    if (openTagName) {
      state.openMark(state.schema.marks.span.create(attrs));
    } else {
      state.closeMark(state.schema.marks.span);
    }
  },
};

export const htmlToWwConvertors = createConvertors(convertors);
