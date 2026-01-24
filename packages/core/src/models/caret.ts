import { CaretEffect } from '../types'

class Caret {
    public blockId: string | null = null
    public inlineId: string | null = null
    public position: number | null = null
    public affinity?: 'start' | 'end'

    constructor(
        private rootElement: HTMLElement,
    ) {}

    clear() {
        this.blockId = null
        this.inlineId = null
        this.position = null
        this.affinity = undefined
    }

    getPositionInInline(inlineEl: HTMLElement) {
        const sel = window.getSelection()
        let caretPositionInInline = 0
        if (sel && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0)
            const preRange = document.createRange()
            preRange.selectNodeContents(inlineEl)
            preRange.setEnd(range.startContainer, range.startOffset)
            caretPositionInInline = preRange.toString().length
        }

        return caretPositionInInline
    }

    public restoreCaret(inlineId: string | null = this.inlineId, position: number | null = this.position) {
        if (inlineId === null || position === null) return

        const inlineEl = this.rootElement.querySelector(`[data-inline-id="${inlineId}"]`) as HTMLElement
        if (!inlineEl) {
            console.warn('could not find inline element for caret restore:', inlineId)
            return
        }
      
        this.rootElement.focus()
      
        const selection = window.getSelection()
        if (!selection) return
      
        selection.removeAllRanges()
        const range = document.createRange()
      
        try {
            let placed = false
        
            if (inlineEl.childNodes.length > 0 && inlineEl.firstChild instanceof Text) {
                const textNode = inlineEl.firstChild as Text
                const clamped = Math.min(position, textNode.length)
                range.setStart(textNode, clamped)
                range.collapse(true)
                placed = true
            } 
            else if (inlineEl.childNodes.length > 0) {
                let currentPos = 0
                const walker = document.createTreeWalker(
                    inlineEl,
                    NodeFilter.SHOW_TEXT,
                    null
                )
        
                let node: Text | null
                while ((node = walker.nextNode() as Text)) {
                    const len = node.length
                    if (currentPos + len >= position) {
                        range.setStart(node, position - currentPos)
                        range.collapse(true)
                        placed = true
                        break
                    }
                    currentPos += len
                }
            }
        
            if (!placed) {
                if (inlineEl.childNodes.length > 0) {
                    range.selectNodeContents(inlineEl)
                    range.collapse(false)
                } else {
                    range.setStart(inlineEl, 0)
                    range.collapse(true)
                }
            }
        
            selection.addRange(range)
        
            inlineEl.scrollIntoView({ block: 'nearest' })
        
        } catch (err) {
            console.warn('failed to restore caret:', err)
            this.rootElement.focus()
        }
    }

    public apply(effect: CaretEffect) {
        switch (effect.type) {
            case 'restore':
                this.restoreCaret(effect.caret.inlineId, effect.caret.position)
                break
        }
    }
}

export default Caret
