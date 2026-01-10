import AST from './ast/ast'
import Caret from './caret'
import { EditContext, SelectionRange, SelectionPoint, SelectionType, SelectionEffect } from '../types'

class Selection {
    private rafId: number | null = null
    private focusedBlockId: string | null = null
    private focusedInlineId: string | null = null
    private range: SelectionRange | null = null 
    private suppressSelectionChange: boolean = false

    constructor(
        private ast: AST,
        private caret: Caret,
        private rootElement: HTMLElement,
    ) {}

    attach() {
        document.addEventListener('selectionchange', this.onSelectionChange)
        this.rootElement.addEventListener('focusin', this.onFocusIn)
        this.rootElement.addEventListener('focusout', this.onFocusOut)
        this.rootElement.addEventListener('click', this.onClick)
    }

    detach() {
        document.removeEventListener('selectionchange', this.onSelectionChange)
        this.rootElement.removeEventListener('focusin', this.onFocusIn)
        this.rootElement.removeEventListener('focusout', this.onFocusOut)
        this.rootElement.removeEventListener('click', this.onClick)
    }

    private onSelectionChange = () => {
        if (this.suppressSelectionChange) return

        if (this.rafId !== null) {
            cancelAnimationFrame(this.rafId)
        }
        
        this.rafId = requestAnimationFrame(() => {
            if (this.suppressSelectionChange) return

            const selection = window.getSelection()
            if (!selection || selection.rangeCount === 0) return
            const range = selection.getRangeAt(0)
            this.resolveRange(range)

            console.log('range', JSON.stringify(this.range, null, 2))
        })
    }

    private onFocusIn = (e: FocusEvent) => {
        const target = e.target as HTMLElement
        if (!target.dataset?.inlineId) return
    
        const inline = this.ast.query.getInlineById(target.dataset.inlineId)
        if (!inline) return
    
        const block = this.ast.query.getBlockById(inline.blockId)
        if (!block) return
    
        const marker = block.inlines.find(i => i.type === 'marker')
        if (marker && marker.text.symbolic.length > 0 && block.id !== this.focusedBlockId) {
            const markerEl = this.rootElement.querySelector(
                `[data-inline-id="${marker.id}"]`
            ) as HTMLElement | null
    
            if (markerEl) {
                markerEl.textContent = marker.text.symbolic
                this.focusedBlockId = block.id
            }
        }
    
        const selection = window.getSelection()
        if (!selection || selection.rangeCount === 0) return
    
        const range = selection.getRangeAt(0)
    
        let caretAstPosition: number | null = null
    
        if (target.contains(range.startContainer)) {
            const preRange = document.createRange()
            preRange.selectNodeContents(target)
            preRange.setEnd(range.startContainer, range.startOffset)
    
            const inlineLocalOffset = preRange.toString().length
    
            caretAstPosition =
                block.position.start +
                inline.position.start +
                inlineLocalOffset
        }

        this.suppressSelectionChange = true
    
        target.innerHTML = ''
        const textNode = document.createTextNode(inline.text.symbolic)
        target.appendChild(textNode)

        if (caretAstPosition !== null) {
            const inlineLocalSymbolicOffset =
                caretAstPosition -
                block.position.start -
                inline.position.start
    
            const clampedOffset = Math.max(
                0,
                Math.min(inlineLocalSymbolicOffset, inline.text.symbolic.length)
            )
    
            const newRange = document.createRange()
            newRange.setStart(textNode, clampedOffset)
            newRange.collapse(true)
    
            selection.removeAllRanges()
            selection.addRange(newRange)
        }

        requestAnimationFrame(() => {
            this.suppressSelectionChange = false
        })
    
        this.focusedInlineId = inline.id
    }

    private onFocusOut = (e: FocusEvent) => {
        if (this.focusedInlineId !== null) {
            const inlineEl = this.rootElement?.querySelector(`[data-inline-id="${this.focusedInlineId}"]`) as HTMLElement
            if (!inlineEl) return

            const inline = this.ast.query.getInlineById(this.focusedInlineId)
            if (inline) {
                if (inline.type === 'image') {
                    const imageElement = document.createElement('img')
                    imageElement.id = inline.id
                    imageElement.dataset.inlineId = inline.id
                    imageElement.contentEditable = 'true'
                    imageElement.classList.add('inline', 'image');

                    (imageElement as HTMLImageElement).src = inline.url || '';
                    (imageElement as HTMLImageElement).alt = inline.alt || '';
                    (imageElement as HTMLImageElement).title = inline.title || '';
                    imageElement.textContent = '';

                    inlineEl.replaceWith(imageElement)
                } else {
                    inlineEl.innerHTML = ''
                    const newTextNode = document.createTextNode(inline.text.semantic)
                    inlineEl.appendChild(newTextNode)
                }

                const block = this.ast.query.getBlockById(inline.blockId)
                if (block) {
                    const marker = block.inlines.find(i => i.type === 'marker')
                    if (marker && marker.text.symbolic.length) {
                        const blockElement = this.rootElement.querySelector(`[data-block-id="${block.id}"]`) as HTMLElement
                        if (blockElement) {
                            const markerElement = this.rootElement.querySelector(`[data-inline-id="${marker.id}"]`) as HTMLElement
                            if (markerElement) {
                                markerElement.innerHTML = ''
                                const newTextNode = document.createTextNode(marker.text.semantic)
                                markerElement.append(newTextNode)

                                this.focusedBlockId = null
                            }

                            if (block.type === 'thematicBreak') {
                                const thematicBreakElement = document.createElement('hr') as HTMLElement
                                thematicBreakElement.classList.add('block', 'thematicBreak')
                                thematicBreakElement.id = block.id
                                thematicBreakElement.dataset.blockId = block.id
                                blockElement.replaceWith(thematicBreakElement)
        
                                this.focusedBlockId = null
                                this.focusedInlineId = null
                            }
                        }
                    }
                }
            }
        }

        if (!this.rootElement?.contains(e.relatedTarget as Node)) {
            const target = e.target as HTMLElement
            if (!target.dataset?.inlineId) return

            const inlineId = target.dataset.inlineId!
            const inline = this.ast.query.getInlineById(inlineId)
            if (!inline) return

            target.innerHTML = ''
            const newTextNode = document.createTextNode(inline.text.semantic)
            target.appendChild(newTextNode)

            this.caret.clear()
            this.focusedInlineId = null
        }
    }

    private onClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement

        const tableElement = target.closest('table, tr, td, th')
        if (tableElement && !target.dataset?.blockId && !target.dataset?.inlineId) {
            const blockElement = tableElement.closest('[data-block-id]') as HTMLElement
            if (blockElement?.dataset?.blockId) {
                const block = this.ast.query.getBlockById(blockElement.dataset.blockId)
                if (block && (block.type === 'table' || block.type === 'tableRow' || block.type === 'tableCell' || block.type === 'tableHeader')) {
                    const result = this.findClosestInlineAndPosition(block, e.clientX, e.clientY)
                    if (result) {
                        this.caret.restoreCaret(result.inline.id, result.position)
                        return
                    }

                    const lastInline = this.ast.query.getLastInline(block)
                    if (lastInline) {
                        this.caret.restoreCaret(lastInline.id, lastInline.text.symbolic.length)
                        return
                    }
                }
            }
        }
        
        if (target.dataset?.inlineId) {
            const inline = this.ast.query.getInlineById(target.dataset.inlineId!)
            if (!inline) return

            if (inline.type === 'image' && inline.id !== this.focusedInlineId) {
                const focusedImage = document.createElement('span')
                focusedImage.classList.add('inline', 'image', 'focus')
                focusedImage.id = inline.id
                focusedImage.dataset.inlineId = inline.id
                focusedImage.contentEditable = 'true'

                target.replaceWith(focusedImage)

                const textNode = document.createTextNode(inline.text.symbolic)
                focusedImage.appendChild(textNode)

                const caretOffset = textNode.length

                const selection = window.getSelection()
                if (!selection || selection.rangeCount === 0) return

                const newRange = document.createRange()
                newRange.setStart(textNode, caretOffset)
                newRange.collapse(true)

                selection.removeAllRanges()
                selection.addRange(newRange)

                focusedImage.focus()

                this.focusedInlineId = inline.id
                return
            }
        }

        if (target.dataset?.blockId) {
            const block = this.ast.query.getBlockById(target.dataset.blockId)
            if (block) {
                console.log('block', JSON.stringify(block, null, 2))
                if (block.type === 'thematicBreak') {
                    const marker = block.inlines.find(i => i.type === 'marker')
                    if (marker) {
                        const thematicBreakElement = document.createElement('p') as HTMLElement
                        thematicBreakElement.id = block.id
                        thematicBreakElement.dataset.blockId = block.id
                        thematicBreakElement.classList.add('block', 'thematicBreak', 'focus')
                        target.replaceWith(thematicBreakElement)

                        const markerElement = document.createElement('span') as HTMLElement
                        markerElement.id = marker.id
                        markerElement.dataset.inlineId = marker.id
                        markerElement.contentEditable = 'true'
                        markerElement.classList.add('inline', 'marker')
                        thematicBreakElement.appendChild(markerElement)

                        this.focusedBlockId = block.id
                        this.focusedInlineId = marker.id
                    }
                }

                if (block.type === 'table' || block.type === 'tableRow' || block.type === 'tableCell' || block.type === 'tableHeader') {
                    const result = this.findClosestInlineAndPosition(block, e.clientX, e.clientY)
                    if (result) {
                        this.caret.restoreCaret(result.inline.id, result.position)
                    } else {
                        const lastInline = this.ast.query.getLastInline(block)
                        if (lastInline) {
                            this.caret.restoreCaret(lastInline.id, lastInline.text.symbolic.length)
                        }
                    }
                } else {
                    const lastInline = block.inlines.at(-1)
                    if (lastInline) {
                        this.caret.restoreCaret(lastInline.id, lastInline.text.symbolic.length)
                    }
                }
            }
        }

        if (target.classList.contains('element')) {
            const lastBlock = this.ast.blocks.at(-1)
            if (lastBlock) {
                const lastInline = lastBlock.inlines.at(-1)
                if (lastInline) {
                    this.caret.restoreCaret(lastInline.id, lastInline.text.symbolic.length)
                }
            }
        }
    }

    private resolvePoint(element: Node, position: number, affinity: 'start' | 'end'): SelectionPoint | null {
        let inlineElement: HTMLElement | null = null

        if (element instanceof Text) {
            inlineElement = element.parentElement?.closest('[data-inline-id]') ?? null
        } else if (element instanceof HTMLElement) {
            inlineElement = element.closest('[data-inline-id]') ?? null
        }

        if (!inlineElement || !this.rootElement.contains(inlineElement)) return null

        const inlineId = inlineElement.dataset.inlineId!
        const inline = this.ast.query.getInlineById(inlineId)
        if (!inline) return null

        const block = this.ast.query.getBlockById(inline.blockId)
        if (!block) return null

        const range = document.createRange()
        range.selectNodeContents(inlineElement)
        range.setEnd(element, position)
    
        const inlinePosition = range.toString().length

        position = block.position.start + inline.position.start + inlinePosition

        return {
            blockId: block.id,
            inlineId: inline.id,
            position,
            affinity
        }
    }

    private resolveRange(range: Range) {
        const start = this.resolvePoint(range.startContainer, range.startOffset, 'start')
        const end = this.resolvePoint(range.endContainer, range.endOffset, 'end')

        if (start && end) {
            this.range = {
                start,
                end
            }
        }

        if (!start || !end) {
            this.caret.clear()
            return
        }

        this.range = start.position <= end.position ? { start, end } : { start: end, end: start }

        if (this.range.start.position === this.range.end.position) {
            this.caret.blockId = this.range.start.blockId
            this.caret.inlineId = this.range.start.inlineId
            this.caret.position = this.range.start.position
            this.caret.affinity = this.range.start.affinity
        } else {
            this.caret.clear()
        }
    }

    public resolveInlineContext(): EditContext | null {
        const blockId = this.caret.blockId
        const inlineId = this.caret.inlineId

        if (!blockId || !inlineId) return null
    
        const block = this.ast.query.getBlockById(blockId)
        if (!block) return null
    
        const inlineIndex = block.inlines.findIndex(i => i.id === inlineId)
        if (inlineIndex === -1) return null
    
        const inline = block.inlines[inlineIndex]
    
        const inlineElement = this.rootElement.querySelector(
            `[data-inline-id="${inlineId}"]`
        ) as HTMLElement | null
    
        if (!inlineElement) return null
    
        return {
            block,
            inline,
            inlineIndex,
            inlineElement
        }
    }

    private mapSemanticOffsetToSymbolic(
        semanticLength: number,
        symbolicLength: number,
        semanticOffset: number
    ) {
        if (semanticOffset === 0) return 0

        let ratio = symbolicLength / semanticLength
        ratio = Math.max(0.5, Math.min(2.0, ratio))
        let offset = Math.round(semanticOffset * ratio)

        return Math.max(0, Math.min(offset, symbolicLength))
    }

    private findClosestInlineAndPosition(block: any, clickX: number, clickY: number): { inline: any; position: number } | null {
        const blockElement = this.rootElement?.querySelector(`[data-block-id="${block.id}"]`) as HTMLElement
        if (!blockElement) return null

        const inlineElements = Array.from(blockElement.querySelectorAll('[data-inline-id]')) as HTMLElement[]
        if (inlineElements.length === 0) return null

        let closestInline: HTMLElement | null = null
        let minDistance = Infinity
        let horizontallyAlignedInline: HTMLElement | null = null
        let minVerticalDistance = Infinity

        for (const inlineEl of inlineElements) {
            const rect = inlineEl.getBoundingClientRect()
            
            const isHorizontallyAligned = clickX >= rect.left && clickX <= rect.right
            
            if (isHorizontallyAligned) {
                const verticalDistance = Math.abs(clickY - (rect.top + rect.height / 2))
                if (verticalDistance < minVerticalDistance) {
                    minVerticalDistance = verticalDistance
                    horizontallyAlignedInline = inlineEl
                }
            } else {
                const horizontalDistance = Math.min(Math.abs(clickX - rect.left), Math.abs(clickX - rect.right))
                const verticalDistance = Math.abs(clickY - (rect.top + rect.height / 2))
                const distance = horizontalDistance + verticalDistance
                
                if (distance < minDistance) {
                    minDistance = distance
                    closestInline = inlineEl
                }
            }
        }

        if (horizontallyAlignedInline) {
            closestInline = horizontallyAlignedInline
        }

        if (!closestInline) return null

        const inlineId = closestInline.dataset.inlineId
        if (!inlineId) return null

        let inline = this.ast.query.getInlineById(inlineId)
        if (!inline) return null

        const rect = closestInline.getBoundingClientRect()
        const relativeX = Math.max(0, Math.min(rect.width, clickX - rect.left))
        const textLength = inline.text.symbolic.length
        
        let position = Math.round((relativeX / Math.max(1, rect.width)) * textLength)
        
        const projectedClickY = rect.top + rect.height / 2
        
        if (document.caretRangeFromPoint) {
            const range = document.caretRangeFromPoint(clickX, projectedClickY)
            if (range) {
                let targetInlineEl = closestInline
                let targetRect = rect
                
                if (!closestInline.contains(range.startContainer)) {
                    const rangeInlineEl = (range.startContainer.nodeType === Node.TEXT_NODE 
                        ? range.startContainer.parentElement 
                        : range.startContainer as HTMLElement)?.closest('[data-inline-id]') as HTMLElement
                    if (rangeInlineEl && blockElement?.contains(rangeInlineEl)) {
                        targetInlineEl = rangeInlineEl
                        targetRect = rangeInlineEl.getBoundingClientRect()
                        const rangeInlineId = rangeInlineEl.dataset.inlineId
                        if (rangeInlineId) {
                            const rangeInline = this.ast.query.getInlineById(rangeInlineId)
                            if (rangeInline) {
                                inline = rangeInline
                                const newRelativeX = Math.max(0, Math.min(targetRect.width, clickX - targetRect.left))
                                position = Math.round((newRelativeX / Math.max(1, targetRect.width)) * rangeInline.text.symbolic.length)
                            }
                        }
                    }
                }

                if (targetInlineEl.contains(range.startContainer) || targetInlineEl === range.startContainer) {
                    const tempRange = document.createRange()
                    tempRange.selectNodeContents(targetInlineEl)
                    tempRange.setEnd(range.startContainer, range.startOffset)
                    const rangePosition = tempRange.toString().length
                    if (rangePosition >= 0 && rangePosition <= inline.text.symbolic.length) {
                        position = rangePosition
                    }
                }
            }
        } else if ((document as any).caretPositionFromPoint) {
            const caretPos = (document as any).caretPositionFromPoint(clickX, projectedClickY)
            if (caretPos) {
                const range = document.createRange()
                range.setStart(caretPos.offsetNode, caretPos.offset)
                range.collapse(true)
                
                if (closestInline.contains(range.startContainer) || closestInline === range.startContainer) {
                    const tempRange = document.createRange()
                    tempRange.selectNodeContents(closestInline)
                    tempRange.setEnd(range.startContainer, range.startOffset)
                    const rangePosition = tempRange.toString().length
                    if (rangePosition >= 0 && rangePosition <= inline.text.symbolic.length) {
                        position = rangePosition
                    }
                }
            }
        }

        position = Math.max(0, Math.min(position, inline.text.symbolic.length))

        return { inline, position }
    }

    private getSelectionType(range: SelectionRange): SelectionType {
        if (range.start.position === range.end.position) {
            return 'caret'
        }
    
        if (range.start.blockId === range.end.blockId) {
            return 'inline'
        }
    
        return 'multiBlock'
    }
    
    private resolveSelection(range: SelectionRange): SelectionEffect {
        const result = []
        const blocks = this.ast.blocks
        
        for (const block of blocks) {
            const blockStart = block.position.start
            const blockEnd = block.position.end

            if (blockEnd <= range.start.position) continue
            if (blockStart >= range.end.position) break

            const inlines = []

            for (const inline of block.inlines) {
                const inlineStart = blockStart + inline.position.start
                const inlineEnd = blockStart + inline.position.end

                const from = Math.max(inlineStart, range.start.position)
                const to = Math.min(inlineEnd, range.end.position)

                if (from < to) {
                    inlines.push({ inline, from: from - inlineStart, to: to - inlineStart })
                }
            }

            if (inlines.length > 0) {
                result.push({block, inlines})
            }
        }

        return { blocks: result }
    }

    public renderSelection(effect: SelectionEffect) {
        this.clearSelection()
    
        for (const { inlines } of effect.blocks) {
            for (const { inline, from, to } of inlines) {
                const inlineElement = this.rootElement.querySelector(
                    `[data-inline-id="${inline.id}"]`
                ) as HTMLElement
    
                if (!inlineElement) continue
    
                this.wrapRange(inlineElement, from, to)
            }
        }
    }

    private wrapRange(inlineElement: HTMLElement, from: number, to: number) {
        const text = inlineElement.textContent ?? ''
        inlineElement.textContent = ''
    
        inlineElement.append(
            document.createTextNode(text.slice(0, from)),
            this.mark(text.slice(from, to)),
            document.createTextNode(text.slice(to))
        )
    }
    
    private mark(text: string) {
        const span = document.createElement('span')
        span.classList.add('selection')
        span.textContent = text
        return span
    }
    
    private clearSelection() {
        const selection = window.getSelection()
        if (selection) {
            selection.removeAllRanges()
        }
    }
}

export default Selection
