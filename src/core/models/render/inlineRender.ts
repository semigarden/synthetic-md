import type { Inline } from '../../types'

function getInlineTag(inline: Inline): string {
    switch (inline.type) {
        case 'text':
            return 'span'
        case 'emphasis':
            return 'em'
        case 'strong':
            return 'strong'
        case 'codeSpan':
            return 'code'
        case 'link':
            return 'a'
        case 'autolink':
            return 'a'
        case 'image':
            return 'img'
        case 'strikethrough':
            return 's'
        default:
            return 'span'
    }
}

function renderInlines(inlines: Inline[], parent: HTMLElement) {
    parent.replaceChildren()

    for (const inline of inlines) {
        parent.appendChild(renderInline(inline))
    }
}

function renderInline(inline: Inline): Node {
    const tag = getInlineTag(inline)
    const inlineElement = document.createElement(tag)

    inlineElement.id = inline.id
    inlineElement.dataset.inlineId = inline.id
    inlineElement.textContent = inline.text.semantic
    inlineElement.contentEditable = 'false'
    inlineElement.classList.add('inline', inline.type)

    if (inline.type === 'link') {
        ;(inlineElement as HTMLAnchorElement).href = inline.url || ''
        ;(inlineElement as HTMLAnchorElement).title = inline.title || ''
    }

    if (inline.type === 'autolink') {
        ;(inlineElement as HTMLAnchorElement).href = inline.url || ''
    }

    if (inline.type === 'image') {
        ;(inlineElement as HTMLImageElement).src = inline.url || ''
        ;(inlineElement as HTMLImageElement).alt = inline.alt || ''
        ;(inlineElement as HTMLImageElement).title = inline.title || ''
        inlineElement.textContent = '';
    }

    return inlineElement
}

export { renderInlines }
