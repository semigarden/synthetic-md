import { Document, Block, Inline } from '../ast/types'

export function renderAST(
    ast: Document,
    container: HTMLElement,
    focusedInlineId: string | null = null,
  ) {
    container.textContent = '' // full reset

    console.log('focusedInlineId', focusedInlineId)
  
    for (const block of ast.blocks) {
      container.appendChild(renderBlock(block, focusedInlineId))
    }
}

function renderBlock(block: Block, focusedInlineId: string | null): HTMLElement {
    switch (block.type) {
      case 'paragraph': {
        const el = document.createElement('p')
        el.id = block.id
        el.dataset.blockId = block.id
        renderInlines(block.inlines, el, focusedInlineId)
        return el
      }
  
      case 'heading': {
        const el = document.createElement(`h${block.level}`)
        el.id = block.id
        el.dataset.blockId = block.id
        renderInlines(block.inlines, el, focusedInlineId)
        return el
      }
  
      default:
        return document.createElement('div')
    }
}

function renderInlines(
    inlines: Inline[],
    parent: HTMLElement,
    focusedInlineId: string | null,
  ) {
    for (const inline of inlines) {
      parent.appendChild(renderInline(inline, focusedInlineId))
    }
}

function renderInline(inline: Inline, focusedInlineId: string | null): Node {
    const isFocused = inline.id === focusedInlineId

    // console.log('isFocused', isFocused, JSON.stringify(inline, null, 2))

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
