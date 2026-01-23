import type Ast from '../ast/ast'
import type Caret from '../caret'
import type { EditContext, SelectionPoint, SelectionRange } from '../../types'

function mapSemanticOffsetToSymbolic(
    semanticLength: number,
    symbolicLength: number,
    semanticOffset: number
) {
    if (semanticOffset === 0) return 0

    let ratio = symbolicLength / semanticLength
    ratio = Math.max(0.5, Math.min(2.0, ratio))
    const offset = Math.round(semanticOffset * ratio)

    return Math.max(0, Math.min(offset, symbolicLength))
}

function getBlockElementsInSelection(root: HTMLElement, selection: Selection): HTMLElement[] {
    if (!selection.rangeCount) return []
    
    const foundElements: HTMLElement[] = []
    const allBlocks = Array.from(root.querySelectorAll('[data-block-id]')) as HTMLElement[]
    
    for (const el of allBlocks) {
        if (selection.containsNode(el, true)) {
            foundElements.push(el)
        }
    }
    
    return foundElements
}

function getInlineElementsInSelection(root: HTMLElement, selection: Selection): HTMLElement[] {
    if (!selection.rangeCount) return []
    
    const foundElements: HTMLElement[] = []
    const allInlines = Array.from(root.querySelectorAll('[data-inline-id]')) as HTMLElement[]
    
    for (const el of allInlines) {
        if (selection.containsNode(el, true)) {
            foundElements.push(el)
        }
    }

    return foundElements
}

function comparePoints(_ast: Ast, a: SelectionPoint, b: SelectionPoint): number {
    return a.position - b.position
}

function inlineToAstPosition(ast: Ast, inlineId: string, position: number): number {
    const inline = ast.query.getInlineById(inlineId)
    if (!inline) return position

    const block = ast.query.getBlockById(inline.blockId)
    if (!block) return position

    const blockStart = block.position?.start ?? 0
    const inlineStart = inline.position?.start ?? 0

    return blockStart + inlineStart + position
}

function getSelectedElements(root: HTMLElement, selection: Selection): {
    blockElements: HTMLElement[]
    inlineElements: HTMLElement[]
} {
    const blockElements = getBlockElementsInSelection(root, selection)
    const inlineElements = getInlineElementsInSelection(root, selection)

    return { blockElements, inlineElements }
}

function resolvePoint(ast: Ast, node: Node, offset: number): SelectionPoint | null {
    const element = node instanceof HTMLElement ? node : node.parentElement
    if (!element) return null
  
    const inlineWrap = element.closest('[data-inline-id]') as HTMLElement | null
    if (!inlineWrap) return null
  
    const inlineId = inlineWrap.dataset.inlineId!
    const inline = ast.query.getInlineById(inlineId)
    if (!inline) return null
  
    const symbolicEl = (inlineWrap.querySelector('.symbolic') as HTMLElement | null) ?? inlineWrap

    const range = document.createRange()
    range.selectNodeContents(symbolicEl)
  
    let point: Range | null = null
    try {
        point = document.createRange()
        point.setStart(node, offset)
        point.collapse(true)
    } catch {
        point = null
    }
    if (!point) return null

    let localOffset = 0
    try {
        const pre = document.createRange()
        pre.setStart(range.startContainer, range.startOffset)
        pre.setEnd(point.startContainer, point.startOffset)
        localOffset = pre.toString().length
    } catch {
        localOffset = 0
    }

    localOffset = Math.max(0, Math.min(localOffset, inline.text.symbolic.length))

    return { blockId: inline.blockId, inlineId, position: localOffset }
}

function resolveRange(ast: Ast, caret: Caret, root: HTMLElement, selection: Selection): SelectionRange | null {
    if (!selection.rangeCount) { caret.clear(); return null }
  
    const range = selection.getRangeAt(0)

    const start = resolvePoint(ast, range.startContainer, range.startOffset)
    const end   = resolvePoint(ast, range.endContainer, range.endOffset)
    if (!start || !end) { caret.clear(); return null }
  
    let orderedStart = start
    let orderedEnd = end
    if (comparePoints(ast, start, end) > 0) {
        orderedStart = end
        orderedEnd = start
    }
  
    const direction =
        (selection.anchorNode === range.startContainer &&
        selection.anchorOffset === range.startOffset)
            ? 'forward'
            : 'backward'
  
    const isSamePoint =
        orderedStart.blockId === orderedEnd.blockId &&
        orderedStart.inlineId === orderedEnd.inlineId &&
        orderedStart.position === orderedEnd.position
  
    if (isSamePoint) {
        caret.blockId = orderedStart.blockId
        caret.inlineId = orderedStart.inlineId
        caret.position = orderedStart.position
        caret.affinity = direction === 'forward' ? 'end' : 'start'
    } else {
        caret.clear()
    }
  
    return { start: orderedStart, end: orderedEnd, direction }
}

function resolveInlineContext(
    ast: Ast,
    caret: Caret,
    rootElement: HTMLElement
): EditContext | null {
    const blockId = caret.blockId
    const inlineId = caret.inlineId
    if (!blockId || !inlineId) return null

    const block = ast.query.getBlockById(blockId)
    if (!block) return null

    const inlineIndex = block.inlines.findIndex(i => i.id === inlineId)
    if (inlineIndex === -1) return null

    const inline = block.inlines[inlineIndex]

    const inlineElement = rootElement.querySelector(
        `[data-inline-id="${inlineId}"]`
    ) as HTMLElement | null
    if (!inlineElement) return null

    return { block, inline, inlineIndex, inlineElement }
}

export { mapSemanticOffsetToSymbolic, getInlineElementsInSelection, getBlockElementsInSelection, getSelectedElements, resolvePoint, comparePoints, resolveRange, resolveInlineContext }
