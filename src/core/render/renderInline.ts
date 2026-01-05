import { Inline } from "../types"


export function renderInlines(
    inlines: Inline[],
    parent: HTMLElement,
    focusedInlineId: string | null,
) {
    parent.replaceChildren()

    for (const inline of inlines) {
        parent.appendChild(renderInline(inline, focusedInlineId))
    }
}

export function renderInline(inline: Inline, focusedInlineId: string | null): Node {
    const isFocused = inline.id === focusedInlineId

    const tag = getInlineTag(inline)
    const inlineEl = document.createElement(tag)
    inlineEl.id = inline.id
    inlineEl.dataset.inlineId = inline.id
    inlineEl.textContent = inline.text.semantic
    inlineEl.contentEditable = 'true'
    inlineEl.classList.add('inline')

    return inlineEl
}

export function getInlineTag(inline: Inline): string {
    switch (inline.type) {
        case 'text':
            return 'span'
        case 'emphasis':
            return 'em'
        case 'strong':
            return 'strong'
        default:
            return 'span'
    }
}
