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
        console.log('onSelectionChange')
        if (this.suppressSelectionChange) return
    
        if (this.rafId !== null) {
            cancelAnimationFrame(this.rafId)
        }
    
        this.rafId = requestAnimationFrame(() => {
            const selection = window.getSelection()
            if (!selection || selection.rangeCount === 0) {
                this.range = null
                this.caret.clear()
                return
            }
    
            const range = selection.getRangeAt(0)
            this.resolveRangeFromSelection(selection, range)
        })
    }

    private onFocusIn = (e: FocusEvent) => {
        console.log('onFocusIn')
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
        console.log('onFocusOut')
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
        // console.log('onClick')
        // const target = e.target as HTMLElement

        // const tableElement = target.closest('table, tr, td, th')
        // if (tableElement && !target.dataset?.blockId && !target.dataset?.inlineId) {
        //     const blockElement = tableElement.closest('[data-block-id]') as HTMLElement
        //     if (blockElement?.dataset?.blockId) {
        //         const block = this.ast.query.getBlockById(blockElement.dataset.blockId)
        //         if (block && (block.type === 'table' || block.type === 'tableRow' || block.type === 'tableCell' || block.type === 'tableHeader')) {
        //             const result = this.findClosestInlineAndPosition(block, e.clientX, e.clientY)
        //             if (result) {
        //                 this.caret.restoreCaret(result.inline.id, result.position)
        //                 return
        //             }

        //             const lastInline = this.ast.query.getLastInline(block)
        //             if (lastInline) {
        //                 this.caret.restoreCaret(lastInline.id, lastInline.text.symbolic.length)
        //                 return
        //             }
        //         }
        //     }
        // }
        
        // if (target.dataset?.inlineId) {
        //     const inline = this.ast.query.getInlineById(target.dataset.inlineId!)
        //     if (!inline) return

        //     if (inline.type === 'image' && inline.id !== this.focusedInlineId) {
        //         const focusedImage = document.createElement('span')
        //         focusedImage.classList.add('inline', 'image', 'focus')
        //         focusedImage.id = inline.id
        //         focusedImage.dataset.inlineId = inline.id
        //         focusedImage.contentEditable = 'true'

        //         target.replaceWith(focusedImage)

        //         const textNode = document.createTextNode(inline.text.symbolic)
        //         focusedImage.appendChild(textNode)

        //         const caretOffset = textNode.length

        //         const selection = window.getSelection()
        //         if (!selection || selection.rangeCount === 0) return

        //         const newRange = document.createRange()
        //         newRange.setStart(textNode, caretOffset)
        //         newRange.collapse(true)

        //         selection.removeAllRanges()
        //         selection.addRange(newRange)

        //         focusedImage.focus()

        //         this.focusedInlineId = inline.id
        //         return
        //     }
        // }

        // if (target.dataset?.blockId) {
        //     const block = this.ast.query.getBlockById(target.dataset.blockId)
        //     if (block) {
        //         console.log('block', JSON.stringify(block, null, 2))
        //         if (block.type === 'thematicBreak') {
        //             const marker = block.inlines.find(i => i.type === 'marker')
        //             if (marker) {
        //                 const thematicBreakElement = document.createElement('p') as HTMLElement
        //                 thematicBreakElement.id = block.id
        //                 thematicBreakElement.dataset.blockId = block.id
        //                 thematicBreakElement.classList.add('block', 'thematicBreak', 'focus')
        //                 target.replaceWith(thematicBreakElement)

        //                 const markerElement = document.createElement('span') as HTMLElement
        //                 markerElement.id = marker.id
        //                 markerElement.dataset.inlineId = marker.id
        //                 markerElement.contentEditable = 'true'
        //                 markerElement.classList.add('inline', 'marker')
        //                 thematicBreakElement.appendChild(markerElement)

        //                 this.focusedBlockId = block.id
        //                 this.focusedInlineId = marker.id
        //             }
        //         }

        //         if (block.type === 'table' || block.type === 'tableRow' || block.type === 'tableCell' || block.type === 'tableHeader') {
        //             const result = this.findClosestInlineAndPosition(block, e.clientX, e.clientY)
        //             if (result) {
        //                 this.caret.restoreCaret(result.inline.id, result.position)
        //             } else {
        //                 const lastInline = this.ast.query.getLastInline(block)
        //                 if (lastInline) {
        //                     this.caret.restoreCaret(lastInline.id, lastInline.text.symbolic.length)
        //                 }
        //             }
        //         } else {
        //             const lastInline = block.inlines.at(-1)
        //             if (lastInline) {
        //                 this.caret.restoreCaret(lastInline.id, lastInline.text.symbolic.length)
        //             }
        //         }
        //     }
        // }

        // if (target.classList.contains('element')) {
        //     const lastBlock = this.ast.blocks.at(-1)
        //     if (lastBlock) {
        //         const lastInline = lastBlock.inlines.at(-1)
        //         if (lastInline) {
        //             this.caret.restoreCaret(lastInline.id, lastInline.text.symbolic.length)
        //         }
        //     }
        // }
    }

    // private resolvePoint(element: Node, position: number, affinity: 'start' | 'end'): SelectionPoint | null {
    //     let inlineElement: HTMLElement | null = null

    //     if (element instanceof Text) {
    //         inlineElement = element.parentElement?.closest('[data-inline-id]') ?? null
    //     } else if (element instanceof HTMLElement) {
    //         inlineElement = element.closest('[data-inline-id]') ?? null
    //     }

    //     if (!inlineElement || !this.rootElement.contains(inlineElement)) return null

    //     const inlineId = inlineElement.dataset.inlineId!
    //     const inline = this.ast.query.getInlineById(inlineId)
    //     if (!inline) return null

    //     const block = this.ast.query.getBlockById(inline.blockId)
    //     if (!block) return null

    //     const range = document.createRange()
    //     range.selectNodeContents(inlineElement)
    //     range.setEnd(element, position)
    
    //     const inlinePosition = range.toString().length

    //     position = block.position.start + inline.position.start + inlinePosition

    //     return {
    //         blockId: block.id,
    //         inlineId: inline.id,
    //         position,
    //         affinity
    //     }
    // }

    private resolvePoint(node: Node, offset: number): SelectionPoint | null {
        let el: HTMLElement | null =
            node instanceof HTMLElement ? node : node.parentElement
    
        if (!el) return null
    
        const inlineEl = el.closest('[data-inline-id]') as HTMLElement
        if (!inlineEl) return null
    
        const inlineId = inlineEl.dataset.inlineId!
        const inline = this.ast.query.getInlineById(inlineId)
        if (!inline) return null
    
        return {
            blockId: inline.blockId,
            inlineId,
            position: offset
        }
    }

    public resolveRange(): SelectionRange | null {
        const sel = window.getSelection()
        if (!sel || sel.rangeCount === 0) return null
    
        const domRange = sel.getRangeAt(0)
    
        const start = this.resolvePoint(
            domRange.startContainer,
            domRange.startOffset,
        )
    
        const end = this.resolvePoint(
            domRange.endContainer,
            domRange.endOffset,
        )
    
        if (!start || !end) return null
    
        const direction = sel.anchorNode === domRange.startContainer &&
                          sel.anchorOffset === domRange.startOffset
            ? 'forward'
            : 'backward'
    
        // canonicalize start <= end
        if (this.comparePoints(start, end) > 0) {
            return { start: end, end: start, direction }
        }
    
        return { start, end, direction }
    }
    
    private comparePoints(a: SelectionPoint, b: SelectionPoint): number {
        if (a.blockId !== b.blockId) {
            const flatBlocks = this.ast.query.flattenBlocks(this.ast.blocks)
            const aEntry = flatBlocks.find(entry => entry.block.id === a.blockId)
            const bEntry = flatBlocks.find(entry => entry.block.id === b.blockId)
            if (!aEntry || !bEntry) return 0
            return aEntry.index - bEntry.index
        }
    
        if (a.inlineId !== b.inlineId) {
            const flatInlines = this.ast.query.flattenInlines(this.ast.blocks)
            const aEntry = flatInlines.find(entry => entry.inline.id === a.inlineId)
            const bEntry = flatInlines.find(entry => entry.inline.id === b.inlineId)
            if (!aEntry || !bEntry) return 0
            return aEntry.index - bEntry.index
        }
    
        return a.position - b.position
    }    

    private resolveRangeFromSelection(selection: globalThis.Selection, range: Range) {
        const anchor = this.resolvePoint(
            selection.anchorNode!,
            selection.anchorOffset,
            // 'start'
        )
    
        const focus = this.resolvePoint(
            selection.focusNode!,
            selection.focusOffset,
            // 'end'
        )
    
        if (!anchor || !focus) {
            this.range = null
            this.caret.clear()
            return
        }
    
        const direction =
            selection.anchorNode === selection.focusNode
                ? selection.anchorOffset <= selection.focusOffset
                    ? 'forward'
                    : 'backward'
                : anchor.position <= focus.position
                    ? 'forward'
                    : 'backward'
    
        const ordered =
            anchor.position <= focus.position
                ? { start: anchor, end: focus }
                : { start: focus, end: anchor }
    
        this.range = {
            ...ordered,
            direction
        }
    
        if (ordered.start.position === ordered.end.position) {
            this.caret.blockId = ordered.start.blockId
            this.caret.inlineId = ordered.start.inlineId
            this.caret.position = ordered.start.position
            this.caret.affinity = direction === 'forward' ? 'end' : 'start'
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
    
    private resolveTextNodeAt(
        inlineEl: HTMLElement,
        offset: number
    ): { node: Text; offset: number } | null {
        let remaining = offset
    
        for (const child of inlineEl.childNodes) {
            if (child.nodeType === Node.TEXT_NODE) {
                const text = child as Text
                if (remaining <= text.length) {
                    return { node: text, offset: remaining }
                }
                remaining -= text.length
            } else if (child instanceof HTMLElement) {
                const len = child.textContent?.length ?? 0
                if (remaining <= len) {
                    const text = child.firstChild
                    if (text instanceof Text) {
                        return { node: text, offset: remaining }
                    }
                    return null
                }
                remaining -= len
            }
        }

        const last = inlineEl.lastChild
        if (last instanceof Text) {
            return { node: last, offset: last.length }
        }
    
        return null
    }    
}

export default Selection
