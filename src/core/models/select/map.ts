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

function isElementInRange(el: HTMLElement, range: Range): boolean {
  try {
    // Check if element contains the start or end of the range
    const containsStart = el.contains(range.startContainer) || el === range.startContainer
    const containsEnd = el.contains(range.endContainer) || el === range.endContainer
    
    if (containsStart || containsEnd) {
      return true
    }
    
    // Check if element is contained within the range
    const elRange = document.createRange()
    elRange.selectNodeContents(el)
    
    // Check if ranges overlap using compareBoundaryPoints
    // Two ranges overlap if: range1.start < range2.end && range1.end > range2.start
    const rangeStartToElEnd = range.compareBoundaryPoints(Range.START_TO_END, elRange)
    const rangeEndToElStart = range.compareBoundaryPoints(Range.END_TO_START, elRange)
    
    // Ranges overlap if start is before element end AND end is after element start
    const overlaps = rangeStartToElEnd < 0 && rangeEndToElStart > 0
    
    if (overlaps) {
      return true
    }
    
    // Also check if element contains the range (element wraps the entire selection)
    const elStartToRangeStart = elRange.compareBoundaryPoints(Range.START_TO_START, range)
    const elEndToRangeEnd = elRange.compareBoundaryPoints(Range.END_TO_END, range)
    const elementContainsRange = elStartToRangeStart <= 0 && elEndToRangeEnd >= 0
    
    return elementContainsRange
  } catch {
    // Fallback to intersectsNode if compareBoundaryPoints fails
    try {
      return range.intersectsNode(el)
    } catch {
      return false
    }
  }
}

function isNodeBetween(startNode: Node, endNode: Node, testNode: Node): boolean {
  // Check if testNode is between startNode and endNode in document order
  const posToStart = testNode.compareDocumentPosition(startNode)
  const posToEnd = testNode.compareDocumentPosition(endNode)
  
  // testNode is after startNode and before endNode
  const afterStart = !(posToStart & Node.DOCUMENT_POSITION_FOLLOWING) || 
                     startNode.contains(testNode)
  const beforeEnd = !(posToEnd & Node.DOCUMENT_POSITION_PRECEDING) ||
                    endNode.contains(testNode)
  
  return afterStart && beforeEnd
}

function getElementsInRange(root: HTMLElement, range: Range, selector: string): HTMLElement[] {
  if (range.collapsed) {
    const el =
      (range.startContainer instanceof HTMLElement 
        ? range.startContainer 
        : range.startContainer.parentElement)
        ?.closest(selector) as HTMLElement | null
    return el ? [el] : []
  }

  const foundElements = new Set<HTMLElement>()
  
  // Get elements that contain the start/end nodes
  let node: Node | null = range.startContainer
  while (node && node !== root) {
    if (node instanceof HTMLElement && node.matches(selector)) {
      foundElements.add(node)
    }
    node = node.parentElement
  }
  
  node = range.endContainer
  while (node && node !== root) {
    if (node instanceof HTMLElement && node.matches(selector)) {
      foundElements.add(node)
    }
    node = node.parentElement
  }
  
  // Get all candidates and check if they're between start and end
  const allCandidates = Array.from(root.querySelectorAll(selector)) as HTMLElement[]
  
  for (const el of allCandidates) {
    if (foundElements.has(el)) continue
    
    // Check if element is between start and end containers
    if (isNodeBetween(range.startContainer, range.endContainer, el)) {
      foundElements.add(el)
      continue
    }
    
    // Also check if element intersects the range (for partial selections)
    try {
      if (range.intersectsNode(el)) {
        foundElements.add(el)
      }
    } catch {
      // Ignore errors
    }
  }
  
  return Array.from(foundElements)
}

function getInlineElementsInSelection(root: HTMLElement, selection: Selection): HTMLElement[] {
    if (!selection.rangeCount) return []
    
    const foundElements: HTMLElement[] = []
    const allInlines = Array.from(root.querySelectorAll('[data-inline-id]')) as HTMLElement[]
    
    for (const el of allInlines) {
      // Check if selection contains this node (fully or partially)
      // The second parameter `true` means partial containment counts
      if (selection.containsNode(el, true)) {
        foundElements.push(el)
      }
    }
    
    return foundElements
  }

function getBlockElementsInSelection(root: HTMLElement, selection: Selection): HTMLElement[] {
    if (!selection.rangeCount) return []
    
    const foundElements: HTMLElement[] = []
    const allBlocks = Array.from(root.querySelectorAll('[data-block-id]')) as HTMLElement[]
    
    for (const el of allBlocks) {
      // Check if selection contains this node (fully or partially)
      if (selection.containsNode(el, true)) {
        foundElements.push(el)
      }
    }
    
    return foundElements
  }

function getAllSelectedElements(root: HTMLElement, selection: Selection): {
    inlineElements: HTMLElement[]
    blockElements: HTMLElement[]
    allElements: HTMLElement[]
} {
    const inlineElements = getInlineElementsInSelection(root, selection)
    const blockElements = getBlockElementsInSelection(root, selection)
    const allElements = [...inlineElements, ...blockElements]
    
    return { inlineElements, blockElements, allElements }
}

function normalizeDomPoint(node: Node, offset: number, prefer: "left" | "right") {
    // If already a text node, keep it.
    if (node.nodeType === Node.TEXT_NODE) {
      return { node, offset }
    }
  
    // If element node: offset is child index, not char offset.
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element
      const children = el.childNodes
      if (children.length === 0) return { node, offset: 0 }
  
      // Pick a child based on boundary + preference
      let target: Node | null = null
      if (prefer === "right") {
        target = children[Math.min(offset, children.length - 1)] ?? children[children.length - 1]
      } else {
        target = children[Math.max(0, Math.min(offset - 1, children.length - 1))] ?? children[0]
      }
  
      // Descend to a text node
      while (target && target.nodeType === Node.ELEMENT_NODE && (target as Element).childNodes.length) {
        const cn = (target as Element).childNodes as NodeListOf<Node>
        target = prefer === "right" ? cn[0] : cn[cn.length - 1]
      }
  
      if (target && target.nodeType === Node.TEXT_NODE) {
        const text = target as Text
        return { node: text, offset: prefer === "right" ? 0 : text.length }
      }
  
      // If we still didn't hit a text node, fallback to original element point.
      return { node, offset: 0 }
    }
  
    // Other node types: fallback
    return { node, offset: 0 }
  }

function resolvePoint(ast: Ast, node: Node, offset: number): SelectionPoint | null {
    const el = node instanceof HTMLElement ? node : node.parentElement
    if (!el) return null
  
    const inlineEl = el.closest("[data-inline-id]") as HTMLElement | null
    if (!inlineEl) return null
  
    const inlineId = inlineEl.dataset.inlineId!
    const inline = ast.query.getInlineById(inlineId)
    if (!inline) return null
  
    const symbolicEl =
      (inlineEl.querySelector(".symbolic") as HTMLElement | null) ?? inlineEl
  
    let localOffset = offset
  
    // If endpoint isn't inside symbolic, clamp to 0 or end depending on DOM position.
    if (!symbolicEl.contains(node)) {
      // If node is inside this inline but not inside symbolic (e.g. semantic), treat as end.
      localOffset = inline.text.symbolic.length
      return { blockId: inline.blockId, inlineId, position: localOffset }
    }
  
    try {
      const pre = document.createRange()
      pre.selectNodeContents(symbolicEl)
      pre.setEnd(node, offset)
      localOffset = pre.toString().length
    } catch {
      // fallback
    }
  
    localOffset = Math.max(0, Math.min(localOffset, inline.text.symbolic.length))
    return { blockId: inline.blockId, inlineId, position: localOffset }
  }

function comparePoints(ast: Ast, a: SelectionPoint, b: SelectionPoint): number {
    if (a.blockId !== b.blockId) {
        const flatBlocks = ast.query.flattenBlocks(ast.blocks)
        const aEntry = flatBlocks.find(entry => entry.block.id === a.blockId)
        const bEntry = flatBlocks.find(entry => entry.block.id === b.blockId)
        if (!aEntry || !bEntry) return 0
        return aEntry.index - bEntry.index
    }

    if (a.inlineId !== b.inlineId) {
        const flatInlines = ast.query.flattenInlines(ast.blocks)
        const aEntry = flatInlines.find(entry => entry.inline.id === a.inlineId)
        const bEntry = flatInlines.find(entry => entry.inline.id === b.inlineId)
        if (!aEntry || !bEntry) return 0
        return aEntry.index - bEntry.index
    }

    return a.position - b.position
}

function resolveRangeFromSelection(ast: Ast, caret: Caret, selection: globalThis.Selection): SelectionRange | null {
    if (!selection.rangeCount) {
      caret.clear()
      return null
    }
  
    // Normalize endpoints to text nodes
    const a = normalizeDomPoint(selection.anchorNode!, selection.anchorOffset, "right")
    const f = normalizeDomPoint(selection.focusNode!, selection.focusOffset, "right")
  
    const anchor = resolvePoint(ast, a.node, a.offset)
    const focus  = resolvePoint(ast, f.node, f.offset)
  
    if (!anchor || !focus) {
      caret.clear()
      return null
    }
  
    const comparison = comparePoints(ast, anchor, focus)
    const direction = comparison <= 0 ? "forward" : "backward"
    const ordered = comparison <= 0 ? { start: anchor, end: focus } : { start: focus, end: anchor }
  
    const isSamePoint =
      ordered.start.blockId === ordered.end.blockId &&
      ordered.start.inlineId === ordered.end.inlineId &&
      ordered.start.position === ordered.end.position
  
    if (isSamePoint) {
      caret.blockId = ordered.start.blockId
      caret.inlineId = ordered.start.inlineId
      caret.position = ordered.start.position
      caret.affinity = direction === "forward" ? "end" : "start"
    } else {
      caret.clear()
    }
  
    return { ...ordered, direction }
  }

function resolveRange(ast: Ast): SelectionRange | null {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return null

    const domRange = sel.getRangeAt(0)

    const start = resolvePoint(ast, domRange.startContainer, domRange.startOffset)
    const end = resolvePoint(ast, domRange.endContainer, domRange.endOffset)
    if (!start || !end) return null

    const direction =
        sel.anchorNode === domRange.startContainer && sel.anchorOffset === domRange.startOffset
            ? 'forward'
            : 'backward'

    if (comparePoints(ast, start, end) > 0) {
        return { start: end, end: start, direction }
    }

    return { start, end, direction }
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

export { mapSemanticOffsetToSymbolic, getInlineElementsInSelection, getBlockElementsInSelection, getAllSelectedElements, resolvePoint, comparePoints, resolveRangeFromSelection, resolveRange, resolveInlineContext }
