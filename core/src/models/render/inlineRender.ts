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
        // case 'image':
        //     return 'img'
        case 'strikethrough':
            return 's'
        default:
            return 'span'
    }
}

function renderInlines(inlines: Inline[], parent: HTMLElement) {
    parent.replaceChildren()

    for (const inline of inlines) {
        const inlineElement = renderInline(inline)
        parent.appendChild(inlineElement)
    }
}

function renderInline(inline: Inline): HTMLElement {
    const tag = getInlineTag(inline)
    const inlineElement = document.createElement(tag)

    inlineElement.id = inline.id
    inlineElement.dataset.inlineId = inline.id
    // inlineElement.contentEditable = 'false'
    inlineElement.classList.add('inline', inline.type)

    const symbolicText = document.createElement('span')
    symbolicText.textContent = inline.text.symbolic
    symbolicText.classList.add('symbolic')

    const semanticText = document.createElement('span')
    semanticText.textContent = inline.text.semantic
    semanticText.classList.add('semantic')

    inlineElement.appendChild(symbolicText)
    inlineElement.appendChild(semanticText)

    if (inline.type === 'link') {
        ;(inlineElement as HTMLAnchorElement).href = inline.url.replace(/[\u200B\u200C\u200D\uFEFF]/g, '') || ''
        ;(inlineElement as HTMLAnchorElement).title = inline.title ? `${inline.title}\nCtrl + Click to follow link` : 'Ctrl + Click to follow link'
    }

    if (inline.type === 'autolink') {
        ;(inlineElement as HTMLAnchorElement).href = inline.url || ''
        ;(inlineElement as HTMLAnchorElement).title = 'Ctrl + Click to follow link'
    }

    if (inline.type === 'image') {
        const img = document.createElement('img')
        img.classList.add('inline', 'image')
        img.src = inline.url || ''
        img.alt = inline.alt || ''
        img.title = inline.title || ''
        semanticText.textContent = ''
        inlineElement.prepend(img)
    }

    return inlineElement
}

export { renderInlines }
