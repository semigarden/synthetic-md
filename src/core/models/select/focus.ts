import type Ast from '../ast/ast'
import type { Inline } from '../../types'
import { mapSemanticOffsetToSymbolic } from './map'

type FocusState = {
    focusedBlockId: string | null
    focusedInlineId: string | null
    focusedInlineIds: string[]
    focusedBlockIds: string[]
}

class Focus {
    constructor(
        private ast: Ast,
        private rootElement: HTMLElement,
    ) {}

    public focusInlines(inlineIds: string[]) {
        for (const inlineId of inlineIds) {
            this.focusInline(inlineId)
        }
    }

    public unfocusInlines(inlineIds: string[]) {
        for (const inlineId of inlineIds) {
            this.unfocusInline(inlineId)
        }
    }

    public focusBlocks(blockIds: string[]) {
        for (const blockId of blockIds) {
            this.focusBlock(blockId)
        }
    }

    private placeCaret(el: HTMLElement, at: 'start' | 'end' = 'end') {
        const sel = el.ownerDocument.getSelection();
        console.log('placeCaret', sel)
        if (!sel) return;
      
        const range = el.ownerDocument.createRange();
        range.selectNodeContents(el);
        range.collapse(at === 'start');
      
        sel.removeAllRanges();
        sel.addRange(range);
    }

    public focusBlock(blockId: string) {
        const blockElement = this.rootElement.querySelector(
            `[data-block-id="${blockId}"]`
        ) as HTMLElement | null
        if (!blockElement) return
        blockElement.classList.add('focused')

        // this.rootElement.focus()

        // // const markerElement = blockElement.querySelector('.marker') as HTMLElement | null
        // // if (markerElement) {
        // //     markerElement.classList.add('focused')

        // //     if (blockElement.classList.contains('thematicBreak')) {
        // //         const markerSymbolicElement = markerElement.querySelector('.symbolic') as HTMLElement | null
        // //         if (markerSymbolicElement) {
        // //             this.placeCaret(markerSymbolicElement, 'end')
        // //         }
        // //     }
        // // }
    }

    public unfocusBlocks(blockIds: string[]) {
        for (const blockId of blockIds) {
            this.unfocusBlock(blockId)
        }
    }

    public unfocusBlock(blockId: string) {
        const blockElement = this.rootElement.querySelector(
            `[data-block-id="${blockId}"]`
        ) as HTMLElement | null
        if (!blockElement) return
        blockElement.classList.remove('focused')

        const markerElement = blockElement.querySelector('.marker') as HTMLElement | null
        if (markerElement) {
            markerElement.classList.remove('focused')
        }
    }

    public clear(state: FocusState) {
        state.focusedInlineId = null
        state.focusedBlockId = null
    }

    public focusInline(
        inlineId: string
    ) {
        const inlineElement = this.rootElement.querySelector(
            `[data-inline-id="${inlineId}"]`
        ) as HTMLElement | null
        if (!inlineElement) return

        inlineElement.classList.add('focused')
    }

    public unfocusInline(inlineId: string) {
        const inline = this.ast.query.getInlineById(inlineId)
        if (!inline) return

        const inlineElement = this.rootElement.querySelector(
            `[data-inline-id="${inlineId}"]`
        ) as HTMLElement | null
        if (!inlineElement) return

        inlineElement.classList.remove('focused')

        if (inline.type === 'image') {
            // const imageElement = document.createElement('img')
            // imageElement.id = inline.id
            // imageElement.dataset.inlineId = inline.id
            // imageElement.classList.add('inline', 'image')
            // ;(imageElement as HTMLImageElement).src = (inline as any).url || ''
            // ;(imageElement as HTMLImageElement).alt = (inline as any).alt || ''
            // ;(imageElement as HTMLImageElement).title = (inline as any).title || ''
            // inlineElement.replaceWith(imageElement)
        } else {
            // inlineElement.classList.remove('focused')
        }

        // const block = this.ast.query.getBlockById(inline.blockId)
        // if (!block) return

        // const marker = block.inlines.find(i => i.type === 'marker') as Inline | undefined
        // if (marker && marker.text.symbolic.length) {
        //     const markerEl = this.rootElement.querySelector(
        //         `[data-inline-id="${marker.id}"]`
        //     ) as HTMLElement | null

        //     if (markerEl && marker.id !== inlineId) {
        //         if (markerEl.textContent === marker.text.symbolic) {
        //             const hasOtherFocusedInlines = block.inlines.some(i => {
        //                 if (i.type === 'marker' || i.id === inlineId) return false
        //                 const otherInlineEl = this.rootElement.querySelector(
        //                     `[data-inline-id="${i.id}"]`
        //                 ) as HTMLElement | null
        //                 return otherInlineEl && otherInlineEl.textContent === i.text.symbolic
        //             })
                    
        //             if (!hasOtherFocusedInlines) {
        //                 markerEl.textContent = marker.text.semantic
        //             }
        //         }
        //     }

        //     if (block.type === 'thematicBreak') {
        //         const blockEl = this.rootElement.querySelector(
        //             `[data-block-id="${block.id}"]`
        //         ) as HTMLElement | null
        //         if (blockEl) {
        //             const hrEl = document.createElement('hr')
        //             hrEl.classList.add('block', 'thematicBreak')
        //             hrEl.id = block.id
        //             hrEl.dataset.blockId = block.id
        //             blockEl.replaceWith(hrEl)
        //         }
        //     }
        // }
    }
}

export default Focus
