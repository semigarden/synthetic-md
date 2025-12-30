import { Block } from "../ast/types"
import { renderInlines } from "./renderInline"

export function renderBlock(block: Block, focusedInlineId: string | null): HTMLElement {
    let el: HTMLElement
  
    switch (block.type) {
      case 'paragraph':
        el = document.createElement('p')
        break
      case 'heading':
        el = document.createElement(`h${block.level}`)
        break
      case 'codeBlock':
        el = document.createElement('pre')
        const code = document.createElement('code')
        el.appendChild(code)
        renderInlines(block.inlines, code, focusedInlineId)
        break
      default:
        el = document.createElement('div')
    }
  
    el.dataset.blockId = block.id
    el.id = block.id
  
    if (block.type !== 'codeBlock') {
      renderInlines(block.inlines, el, focusedInlineId)
    }
  
    return el
  }








