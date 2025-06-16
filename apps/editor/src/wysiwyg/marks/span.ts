import { Mark as ProsemirrorMark, DOMOutputSpec } from 'prosemirror-model';
import { toggleMark } from 'prosemirror-commands';

import Mark from '@/spec/mark';
import { escapeXml } from '@/utils/common';
import { sanitizeHTML } from '@/sanitizer/htmlSanitizer';
import { getCustomAttrs, getDefaultCustomAttrs } from '@/wysiwyg/helper/node';

import { EditorCommand } from '@t/spec';

export class Span extends Mark {
  get name() {
    return 'span';
  }

  get schema() {
    return {
      attrs: {
        style: { default: null },
        class: { default: null },
        rawHTML: { default: null },
        ...getDefaultCustomAttrs(),
      },
      inclusive: false,
      parseDOM: [
        {
          tag: 'span',
          getAttrs(dom: Node | string) {
            const sanitizedDOM = sanitizeHTML<DocumentFragment>(dom, { RETURN_DOM_FRAGMENT: true })
              .firstChild as HTMLElement;
            const style = sanitizedDOM.getAttribute('style');
            const cls = sanitizedDOM.getAttribute('class');
            const rawHTML = sanitizedDOM.getAttribute('data-raw-html');

            return {
              style,
              class: cls,
              ...(rawHTML && { rawHTML }),
            };
          },
        },
      ],
      toDOM: ({ attrs }: ProsemirrorMark): DOMOutputSpec => [
        attrs.rawHTML || 'span',
        {
          ...(attrs.style && { style: attrs.style }),
          ...(attrs.class && { class: attrs.class }),
          ...getCustomAttrs(attrs),
        },
      ],
    };
  }

  private toggleSpan(): EditorCommand {
    return (payload) => (state, dispatch) => {
      const attrs = payload?.style ? { style: payload.style } : {};

      return toggleMark(state.schema.marks.span, attrs)(state, dispatch);
    };
  }

  commands() {
    return {
      toggleSpan: this.toggleSpan(),
    };
  }
}
