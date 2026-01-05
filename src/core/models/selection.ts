import AST from "./ast"
import Caret from "./caret"
import { EditorContext } from "../types"

class Selection {
    private rafId: number | null = null
    private focusedInlineId: string | null = null

    constructor(
        private rootElement: HTMLElement,
        private caret: Caret,
        private ast: AST,
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
        if (!this.rootElement) return

        if (this.rafId !== null) {
            cancelAnimationFrame(this.rafId)
        }
        
        this.rafId = requestAnimationFrame(() => {
            const selection = window.getSelection()
            if (!selection || selection.rangeCount === 0) return
        
            const range = selection.getRangeAt(0)

            this.resolveRange(range)
        })
    }

    private onFocusIn = (e: FocusEvent) => {
        const target = e.target as HTMLElement
            if (!target.dataset?.inlineId) return
          
            const inline = this.ast.getInlineById(target.dataset.inlineId!)
            if (!inline) return

            const selection = window.getSelection()
            if (!selection || selection.rangeCount === 0) return

            const range = selection.getRangeAt(0)

            let semanticOffset = 0;
            if (target.contains(range.startContainer)) {
                const preRange = document.createRange()
                preRange.selectNodeContents(target)
                preRange.setEnd(range.startContainer, range.startOffset)
                semanticOffset = preRange.toString().length
            }

            const semanticVisibleLength = target.textContent?.length ?? 1

            target.innerHTML = ''
            const newTextNode = document.createTextNode(inline.text.symbolic)
            target.appendChild(newTextNode)

            const symbolicOffset = this.mapSemanticOffsetToSymbolic(
                semanticVisibleLength,
                inline.text.symbolic.length,
                semanticOffset
            )

            const clampedOffset = Math.max(0, Math.min(symbolicOffset, inline.text.symbolic.length))
            
            const newRange = document.createRange()
            newRange.setStart(newTextNode, clampedOffset)
            newRange.collapse(true)

            selection.removeAllRanges()
            selection.addRange(newRange)

            this.focusedInlineId = inline.id
        
    }

    private onFocusOut = (e: FocusEvent) => {
        if (this.focusedInlineId !== null) {
            const inlineEl = this.rootElement?.querySelector(`[data-inline-id="${this.focusedInlineId}"]`) as HTMLElement
            if (!inlineEl) return

            const inline = this.ast.getInlineById(this.focusedInlineId)
            if (inline) {
                inlineEl.innerHTML = ''
                const newTextNode = document.createTextNode(inline.text.semantic)
                inlineEl.appendChild(newTextNode)
            }
        }

        // console.log('focusout')
        if (!this.rootElement?.contains(e.relatedTarget as Node)) {
            const target = e.target as HTMLElement
            if (!target.dataset?.inlineId) return

            const inlineId = target.dataset.inlineId!
            const inline = this.ast.getInlineById(inlineId)
            if (!inline) return

            target.innerHTML = ''
            const newTextNode = document.createTextNode(inline.text.semantic)
            target.appendChild(newTextNode)

            this.caret?.clear()
            this.focusedInlineId = null
        }
    }

    private onClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement
        if (target.dataset?.inlineId) {
            // console.log('click on inline', target.dataset.inlineId)
        }
        if (target.dataset?.blockId) {
            // console.log('click on block', target.dataset.blockId)
            const block = this.ast.getBlockById(target.dataset.blockId)
            if (block) {
                const lastInline = block.inlines.at(-1)
                if (lastInline) {
                    this.caret?.setInlineId(lastInline.id)
                    this.caret?.setBlockId(block.id)
                    this.caret?.setPosition(lastInline.text.symbolic.length)
                    this.caret?.restoreCaret()
                }
            }
        }
        if (target.classList.contains('element')) {
            // console.log('click on syntheticText')
            const lastBlock = this.ast.ast.blocks.at(-1)
            if (lastBlock) {
                const lastInline = lastBlock.inlines.at(-1)
                if (lastInline) {
                    this.caret?.setInlineId(lastInline.id)
                    this.caret?.setBlockId(lastBlock.id)
                    this.caret?.setPosition(lastInline.text.symbolic.length)
                    this.caret?.restoreCaret()
                }
            }
        }
    }

    private resolveRange(range: Range) {
        const container = range.commonAncestorContainer
        
        let inlineEl: HTMLElement | null = null
    
        if (container instanceof HTMLElement) {
            inlineEl = container.closest('[data-inline-id]') ?? null
        } else if (container instanceof Text) {
            inlineEl = container.parentElement?.closest('[data-inline-id]') ?? null
        }
    
        if (!inlineEl || !this.rootElement?.contains(inlineEl)) {
            this.caret?.clear()
            return
        }
    
        const inlineId = inlineEl.dataset.inlineId!
        const inline = this.ast.getInlineById(inlineId)
        if (!inline) return

        const block = this.ast.getBlockById(inline.blockId)
        if (!block) return

        this.caret?.setInlineId(inlineId)
        this.caret?.setBlockId(inline.blockId)
    
        const preRange = range.cloneRange()
        preRange.selectNodeContents(inlineEl)
        preRange.setEnd(range.startContainer, range.startOffset)
        let position = preRange.toString().length + inline.position.start + block.position.start
    
        this.caret?.setPosition(position)
    }

    public resolveInlineContext(): EditorContext | null {
        const blockId = this.caret.getBlockId()
        const inlineId = this.caret.getInlineId()
        console.log('resolve 0')
    
        if (!blockId || !inlineId) return null
    
        // console.log('engine.ast', JSON.stringify(this.engine.ast, null, 2))
        console.log('resolve 1', blockId, inlineId)
        const block = this.ast.getBlockById(blockId)
        if (!block) return null
    
        console.log('resolve 2', inlineId)
        const inlineIndex = block.inlines.findIndex(i => i.id === inlineId)
        if (inlineIndex === -1) return null
    
        console.log('resolve 3')
        const inline = block.inlines[inlineIndex]
    
        console.log('resolve 4')
        const inlineElement = this.rootElement.querySelector(
            `[data-inline-id="${inlineId}"]`
        ) as HTMLElement | null
    
        console.log('resolve 5')
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
}

export default Selection
