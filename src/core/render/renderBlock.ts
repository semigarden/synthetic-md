import { Block } from "../types"
import { renderInlines } from "./renderInline"

export function renderBlock(block: Block, rootElement: HTMLElement, focusedInlineId: string | null = null, renderAt: string = 'current', targetBlock: Block | null = null): HTMLElement {
    let element: HTMLElement = rootElement.querySelector(`[data-block-id="${block.id}"]`) as HTMLElement

    const isNew = !element
    if (element) {
      element.replaceChildren()
    } else {
      switch (block.type) {
        case 'paragraph':
          element = document.createElement('p')
          element.classList.add('paragraph')
          break
        case 'heading':
          element = document.createElement(`h${block.level}`)
          element.classList.add(`h${block.level}`)
          break
        case 'codeBlock':
          element = document.createElement('pre')
          const code = document.createElement('code')
          element.appendChild(code)
          renderInlines(block.inlines, code, focusedInlineId)
          break
        case 'list':
          element = document.createElement(block.ordered ? 'ol' : 'ul')
          element.classList.add('list')
          break
        case 'listItem':
          element = document.createElement('li')
          element.classList.add('listItem')
          break
        default:
          element = document.createElement('div')
      }
    
      element.dataset.blockId = block.id
      element.id = block.id
      element.classList.add('block')
    }

    if (block.type === 'codeBlock') {
      const code = element.querySelector('code') as HTMLElement || document.createElement('code')
      code.innerHTML = ''
      renderInlines(block.inlines, code, focusedInlineId)
      if (!element.querySelector('code')) element.appendChild(code)
    } if (block.type === 'list' || block.type === 'listItem') {
      for (const child of block.blocks) {
        renderBlock(child, element, focusedInlineId)
      }
    } else {
      renderInlines(block.inlines, element, focusedInlineId)
    }

    if (isNew) {
      if (targetBlock) {
        const targetBlockElement = rootElement.querySelector(
          `[data-block-id="${targetBlock.id}"]`
        )
        if (targetBlockElement) {
          switch (renderAt) {
            case 'current':
              targetBlockElement.replaceWith(element)
              break
            case 'previous':
              console.log('previous', JSON.stringify(targetBlockElement, null, 2), JSON.stringify(element, null, 2))
              targetBlockElement.before(element)
              break
            case 'next':
              targetBlockElement.after(element)
              break
          }
        } else {
          rootElement.appendChild(element)
        }
      } else {
        rootElement.appendChild(element)
      }
    }

    return element
}
