import { Block } from "../ast/types"
import { renderInlines } from "./renderInline"

export function renderBlock(block: Block, container: HTMLElement, focusedInlineId: string | null = null, beforeBlock: Block | null = null): HTMLElement {
    let el: HTMLElement = container.querySelector(`[data-block-id="${block.id}"]`) as HTMLElement

    const isNew = !el
    if (el) {
      el.replaceChildren()
    } else {
      switch (block.type) {
        case 'paragraph':
          el = document.createElement('p')
          el.classList.add('paragraph')
          break
        case 'heading':
          el = document.createElement(`h${block.level}`)
          el.classList.add(`h${block.level}`)
          break
        case 'codeBlock':
          el = document.createElement('pre')
          const code = document.createElement('code')
          el.appendChild(code)
          renderInlines(block.inlines, code, focusedInlineId)
          break
        case 'list':
          el = document.createElement(block.ordered ? 'ol' : 'ul')
          el.classList.add('list')
          break
        case 'listItem':
          el = document.createElement('li')
          el.classList.add('listItem')
          break
        default:
          el = document.createElement('div')
      }
    
      el.dataset.blockId = block.id
      el.id = block.id
    }

    if (block.type === 'codeBlock') {
      const code = el.querySelector('code') as HTMLElement || document.createElement('code')
      code.innerHTML = ''
      renderInlines(block.inlines, code, focusedInlineId)
      if (!el.querySelector('code')) el.appendChild(code)
    } if (block.type === 'list' || block.type === 'listItem') {
      for (const child of block.blocks) {
        renderBlock(child, el, focusedInlineId)
      }
    } else {
      renderInlines(block.inlines, el, focusedInlineId)
    }

    if (isNew) {
      if (beforeBlock) {
        const beforeEl = container.querySelector(
          `[data-block-id="${beforeBlock.id}"]`
        )
        if (beforeEl) {
          beforeEl.after(el)
        } else {
          container.appendChild(el)
        }
      } else {
        container.appendChild(el)
      }
    }

    return el
}
