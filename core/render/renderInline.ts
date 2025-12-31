import { Inline } from "../ast/types"


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
    inlineEl.style.whiteSpace = 'pre-wrap'
    inlineEl.style.wordBreak = 'break-word'
    inlineEl.style.wordWrap = 'break-word'
    inlineEl.style.overflowWrap = 'break-word'
    inlineEl.style.textOverflow = 'ellipsis'
    inlineEl.style.maxWidth = '100%'
    inlineEl.style.height = 'auto'
    inlineEl.style.display = 'inline-block'
    inlineEl.style.minWidth = '100px'
    inlineEl.style.textAlign = 'left'
    inlineEl.style.border = '1px solid blue'

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
