import { Document } from '../ast/types'
import { renderBlock } from './renderBlock'

export function renderAST(
  ast: Document,
  container: HTMLElement,
  focusedInlineId: string | null = null
) {
  container.textContent = ''
  for (const block of ast.blocks) {
    container.appendChild(renderBlock(block, container, focusedInlineId))
  }
}
