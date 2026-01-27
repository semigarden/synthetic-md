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

    public focusBlock(blockId: string) {
        const blockElement = this.rootElement.querySelector(
            `[data-block-id="${blockId}"]`
        ) as HTMLElement | null
        if (!blockElement) return
        blockElement.classList.add('focused')

        const markerElements = blockElement.querySelectorAll('.marker') as NodeListOf<HTMLElement>
        for (const markerElement of Array.from(markerElements)) {
            markerElement.classList.add('focused')
        }

        if (blockElement.classList.contains('codeBlock')) {
            const inlineElements = blockElement.querySelectorAll('.inline') as NodeListOf<HTMLElement>
            for (const inlineElement of Array.from(inlineElements)) {
                inlineElement.classList.add('focused')
            }
        }
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

        const markerElements = blockElement.querySelectorAll('.marker') as NodeListOf<HTMLElement>
        for (const markerElement of Array.from(markerElements)) {
            markerElement.classList.remove('focused')
        }

        if (blockElement.classList.contains('codeBlock')) {
            const inlineElements = blockElement.querySelectorAll('.inline') as NodeListOf<HTMLElement>
            for (const inlineElement of Array.from(inlineElements)) {
                inlineElement.classList.remove('focused')
            }
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
    }

    public autoFocus() {
        const firstBlock = this.rootElement.querySelector('.block') as HTMLElement | null
        if (!firstBlock) {
            this.rootElement.focus()
            return
        }

        const inlineEl = firstBlock.querySelector('[data-inline-id]') as HTMLElement | null
        if (!inlineEl) {
            this.rootElement.focus()
            return
        }

        const target = (inlineEl.querySelector('.symbolic') as HTMLElement | null) ?? inlineEl

        if (target.childNodes.length === 0) {
            target.appendChild(document.createTextNode('\u200B'))
        }

        this.rootElement.focus()

        const selection = target.ownerDocument.getSelection()
        if (!selection) return

        const range = target.ownerDocument.createRange()
        range.selectNodeContents(target)
        range.collapse(true)

        selection.removeAllRanges()
        selection.addRange(range)
    }
}

export default Focus
