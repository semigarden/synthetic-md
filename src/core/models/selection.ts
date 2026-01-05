import AST from "./ast"
import Caret from "./caret"

class Selection {
    private rafId: number | null = null

    constructor(
        private rootElement: HTMLElement,
        private ast: AST,
        private caret: Caret
    ) {}

    attach() {
        document.addEventListener('selectionchange', this.onSelectionChange)
    }

    detach() {
        document.removeEventListener('selectionchange', this.onSelectionChange)
    }

    private onSelectionChange() {
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
}

export default Selection
