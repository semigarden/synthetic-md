import { Inline } from "../ast/types"


export function renderInlines(
    inlines: Inline[],
    parent: HTMLElement,
    focusedInlineId: string | null,
) {
    for (const inline of inlines) {
        parent.appendChild(renderInline(inline, focusedInlineId))
    }
}

export function renderInline(inline: Inline, focusedInlineId: string | null): Node {
    const isFocused = inline.id === focusedInlineId

    if (isFocused) {
        
        const span = document.createElement('span')
        span.id = inline.id
        span.dataset.inlineId = inline.id
        span.textContent = inline.text.symbolic
        return span
    }

    switch (inline.type) {
        case 'text':
            const el = document.createElement('span')
            el.id = inline.id
            el.dataset.inlineId = inline.id
            el.textContent = inline.text.semantic
            return el

        case 'emphasis': {
            const el = document.createElement('em')
            el.id = inline.id
            el.dataset.inlineId = inline.id

            for (const child of inline.inlines) {
                el.appendChild(renderInline(child, focusedInlineId))
            }
            return el
        }

        case 'strong': {
            const el = document.createElement('strong')
            el.id = inline.id
            el.dataset.inlineId = inline.id

            for (const child of inline.inlines) {
                el.appendChild(renderInline(child, focusedInlineId))
            }
            return el
        }

        default:
            return document.createTextNode('')
    }
}
