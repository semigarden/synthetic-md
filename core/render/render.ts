import { Change } from '../diff/diff'
import { Document } from '../ast/types'
import { renderBlock } from './renderBlock'
import { renderInlines } from './renderInline'

export function renderFull(
    ast: Document,
    container: HTMLElement,
    focusedInlineId: string | null = null
  ) {
    container.textContent = ''
    for (const block of ast.blocks) {
      container.appendChild(renderBlock(block, focusedInlineId))
    }
  }

export function patchDOM(
  changes: Change[],
  container: HTMLElement,
  focusedInlineId: string | null = null
) {
  const deletes: Change[] = []
  const updates: Change[] = []
  const moves: Change[] = []
  const adds: Change[] = []

  for (const change of changes) {
    switch (change.action) {
      case 'delete': deletes.push(change); break
      case 'update': updates.push(change); break
      case 'move': moves.push(change); break
      case 'add': adds.push(change); break
    }
  }

  for (const { prevBlock } of deletes) {
    if (!prevBlock) continue
    const el = container.querySelector(`[data-block-id="${prevBlock.id}"]`)
    el?.remove()
  }

  for (const { nextBlock } of updates) {
    if (!nextBlock) continue
    const el = container.querySelector(`[data-block-id="${nextBlock.id}"]`) as HTMLElement
    if (!el) continue

    el.textContent = ''
    renderInlines(nextBlock.inlines, el, focusedInlineId)
  }

  const currentChildren = Array.from(container.children) as HTMLElement[]

  for (const change of [...moves, ...adds]) {
    const block = change.nextBlock
    if (!block) continue

    let el = container.querySelector(`[data-block-id="${block.id}"]`) as HTMLElement

    if (!el) {
      el = renderBlock(block, focusedInlineId)
      container.appendChild(el)
    }

    const targetIndex = change.index ?? currentChildren.length
    const referenceNode = currentChildren[targetIndex] || null

    if (el.nextSibling !== referenceNode) {
      container.insertBefore(el, referenceNode)
    }
  }
}
