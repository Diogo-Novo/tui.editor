import { DOMOutputSpec, ProsemirrorNode } from 'prosemirror-model';
import NodeSchema from '@/spec/node';
import { getDefaultCustomAttrs, getCustomAttrs } from '@/wysiwyg/helper/node';
import { sanitizeHTML } from '@/sanitizer/htmlSanitizer';

export class Div extends NodeSchema {
  get name() {
    return 'div';
  }

  get schema() {
    return {
      content: 'block+',
      group: 'block',
      defining: true, // Important for preserving content during transformations
      attrs: {
        ...getDefaultCustomAttrs(),
        class: { default: null },
        style: { default: null },
        id: { default: null },
        textAlign: { default: null }, // Add explicit textAlign support
        rawHTML: { default: null },
      },
      parseDOM: [
        {
          tag: 'div',
          getAttrs(dom: Node | string) {
            const sanitizedDOM = sanitizeHTML<DocumentFragment>(dom, { RETURN_DOM_FRAGMENT: true })
              .firstChild as HTMLElement;

            // Extract all relevant attributes
            const attrs: Record<string, string | null> = {
              class: sanitizedDOM.getAttribute('class'),
              style: sanitizedDOM.getAttribute('style'),
              id: sanitizedDOM.getAttribute('id'),
              textAlign: sanitizedDOM.style.textAlign || null,
              rawHTML: sanitizedDOM.getAttribute('data-raw-html'),
            };

            // Clean up null values
            Object.keys(attrs).forEach((key) => {
              if (attrs[key] === null) {
                delete attrs[key];
              }
            });

            return attrs;
          },
        },
      ],
      toDOM({ attrs }: ProsemirrorNode): DOMOutputSpec {
        const domAttrs: Record<string, string> = {
          ...getCustomAttrs(attrs),
        };

        // Handle class
        if (attrs.class) {
          domAttrs.class = attrs.class;
        }

        // Handle style - merge textAlign if present
        let style = attrs.style || '';

        if (attrs.textAlign) {
          style = style
            ? `${style}; text-align: ${attrs.textAlign}`
            : `text-align: ${attrs.textAlign}`;
        }
        if (style) {
          domAttrs.style = style;
        }

        // Handle ID
        if (attrs.id) {
          domAttrs.id = attrs.id;
        }

        return [attrs.rawHTML || 'div', Object.keys(domAttrs).length ? domAttrs : null, 0];
      },
    };
  }
}
