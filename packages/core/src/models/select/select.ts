import Ast from '../ast/ast'
import Caret from '../caret'
import Focus from './focus'
import { getSelectedElements, resolveRange, resolveInlineContext } from './map'
import type { EditContext, SelectionRange, EditEffect, Block, Inline } from '../../types'

class Select {
    private rafId: number | null = null
    private range: SelectionRange | null = null
    private suppressSelectionChange = false
    private multiInlineMode = false

    private focusState = {
        focusedBlockId: null as string | null,
        focusedInlineId: null as string | null,
        focusedInlineIds: [] as string[],
        focusedBlockIds: [] as string[],
    }

    private focus: Focus

    constructor(
        private ast: Ast,
        private caret: Caret,
        private rootElement: HTMLElement
    ) {
        this.focus = new Focus(ast, rootElement)
    }

    attach() {
        document.addEventListener('selectionchange', this.onSelectionChange)
        this.rootElement.addEventListener('focusin', this.onRootFocusIn)
        this.rootElement.addEventListener('focusout', this.onRootFocusOut)
    }

    detach() {
        document.removeEventListener('selectionchange', this.onSelectionChange)
        this.rootElement.removeEventListener('focusin', this.onRootFocusIn)
        this.rootElement.removeEventListener('focusout', this.onRootFocusOut)
    }

    private onSelectionChange = () => {
        if (this.suppressSelectionChange) return

        if (this.rafId !== null) cancelAnimationFrame(this.rafId)

        this.rafId = requestAnimationFrame(() => {
            const selection = window.getSelection()
            if (!selection || selection.rangeCount === 0) {
                this.range = null
                this.caret.clear()
                this.multiInlineMode = false

                this.focus.unfocusBlocks(this.focusState.focusedBlockIds)
                this.focus.unfocusInlines(this.focusState.focusedInlineIds)
                this.focusState.focusedBlockIds = []
                this.focusState.focusedInlineIds = []
                return
            }

            if (
                !this.rootElement.contains(selection.anchorNode) ||
                !this.rootElement.contains(selection.focusNode)
            ) {
                return
            }

            const selectedElements = getSelectedElements(this.rootElement, selection)

            this.focus.unfocusBlocks(this.focusState.focusedBlockIds)
            this.focus.unfocusInlines(this.focusState.focusedInlineIds)
            this.focusState.focusedBlockIds = []
            this.focusState.focusedInlineIds = []

            for (const el of selectedElements.blockElements) {
                const blockId = el.dataset?.blockId ?? ''
                const block = this.ast.query.getBlockById(blockId)
                if (block) {
                    this.focusState.focusedBlockIds.push(block.id)
                }
            }

            for (const el of selectedElements.inlineElements) {
                const inlineId = el.dataset?.inlineId ?? ''
                const inline = this.ast.query.getInlineById(inlineId)
                if (inline) {
                    this.focusState.focusedInlineIds.push(inline.id)
                }
            }

            this.focus.focusBlocks(this.focusState.focusedBlockIds)
            this.focus.focusInlines(this.focusState.focusedInlineIds)

            const range = resolveRange(this.ast, this.caret, this.rootElement, selection)
            this.range = range
        })
    }

    private onRootFocusIn = () => {
        const selection = window.getSelection()
        if (!selection || selection.rangeCount === 0) {
            this.range = null
            this.caret.clear()
            this.multiInlineMode = false

            this.focus.unfocusBlocks(this.focusState.focusedBlockIds)
            this.focus.unfocusInlines(this.focusState.focusedInlineIds)
            this.focusState.focusedBlockIds = []
            this.focusState.focusedInlineIds = []
            return
        }

        if (
            !this.rootElement.contains(selection.anchorNode) ||
            !this.rootElement.contains(selection.focusNode)
        ) {
            return
        }

        const selectedElements = getSelectedElements(this.rootElement, selection)

        this.focus.unfocusBlocks(this.focusState.focusedBlockIds)
        this.focus.unfocusInlines(this.focusState.focusedInlineIds)
        this.focusState.focusedBlockIds = []
        this.focusState.focusedInlineIds = []

        for (const el of selectedElements.blockElements) {
            const blockId = el.dataset?.blockId ?? ''
            const block = this.ast.query.getBlockById(blockId)
            if (block) {
                this.focusState.focusedBlockIds.push(block.id)
            }
        }

        for (const el of selectedElements.inlineElements) {
            const inlineId = el.dataset?.inlineId ?? ''
            const inline = this.ast.query.getInlineById(inlineId)
            if (inline) {
                this.focusState.focusedInlineIds.push(inline.id)
            }
        }

        this.focus.focusBlocks(this.focusState.focusedBlockIds)
        this.focus.focusInlines(this.focusState.focusedInlineIds)

        const range = resolveRange(this.ast, this.caret, this.rootElement, selection)
        this.range = range
    }

    private onRootFocusOut = (e: FocusEvent) => {
        if (!this.rootElement.contains(e.relatedTarget as Node)) {
            this.focus.unfocusBlocks(this.focusState.focusedBlockIds)
            this.focus.unfocusInlines(this.focusState.focusedInlineIds)
            this.caret.clear()
            this.focus.clear(this.focusState)
            this.focusState.focusedBlockIds = []
            this.focusState.focusedInlineIds = []
            this.multiInlineMode = false
        }
    }

    public resolveInlineContext(): EditContext | null {
        return resolveInlineContext(this.ast, this.caret, this.rootElement)
    }

    public resolveTaskContext(blockId: string): EditContext | null {
        const block = this.ast.query.getBlockById(blockId)
        if (!block) return null

        const blockElement = this.rootElement.querySelector(`[data-block-id="${blockId}"]`) as HTMLElement | null
        if (!blockElement) return null

        const inlineElement = this.placeCaretInFirstInline(blockElement, 'start')
        if (!inlineElement) return null

        const inlineId = inlineElement.dataset.inlineId
        if (!inlineId) return null

        const inline = this.ast.query.getInlineById(inlineId)
        if (!inline) return null
        
        this.caret.blockId = block.id
        this.caret.inlineId = inline.id
        this.caret.position = 0

        return { block, inline, inlineIndex: 0, inlineElement: inlineElement }
    }

    private placeCaretInFirstInline(blockEl: HTMLElement, at: 'start' | 'end' = 'start') {
        const inlineEl = blockEl.querySelector('[data-inline-id]') as HTMLElement | null
        if (!inlineEl) return null
      
        const target = (inlineEl.querySelector('.symbolic') as HTMLElement | null) ?? inlineEl
      
        if (target.childNodes.length === 0) {
            target.appendChild(document.createTextNode('\u200B'))
        }
      
        this.rootElement.focus()
      
        const sel = target.ownerDocument.getSelection()
        if (!sel) return null
      
        const range = target.ownerDocument.createRange()
        range.selectNodeContents(target)
        range.collapse(at === 'start')
      
        sel.removeAllRanges()
        sel.addRange(range)
      
        return inlineEl
    }

    public resolveRange(): SelectionRange | null {
        return this.range
    }

    public isMultiInlineMode(): boolean {
        return this.multiInlineMode
    }

    public clearSelection() {
        this.range = null
        this.multiInlineMode = false
        this.focus.unfocusBlocks(this.focusState.focusedBlockIds)
        this.focus.unfocusInlines(this.focusState.focusedInlineIds)
        this.focusState.focusedBlockIds = []
        this.focusState.focusedInlineIds = []
        this.focusState.focusedBlockId = null
        this.focusState.focusedInlineId = null
    }

    public getSelectedText(): string {
        if (!this.range) return ''
        
        const startBlock = this.ast.query.getBlockById(this.range.start.blockId)
        const endBlock = this.ast.query.getBlockById(this.range.end.blockId)
        if (!startBlock || !endBlock) return ''
        
        const getOffsetInBlock = (block: typeof startBlock, inlineId: string, position: number): number => {
            let offset = 0
            for (const inline of block.inlines) {
                if (inline.id === inlineId) {
                    return offset + position
                }
                offset += inline.text.symbolic.length
            }
            return offset
        }
        
        const startOffset = getOffsetInBlock(startBlock, this.range.start.inlineId, this.range.start.position)
        const endOffset = getOffsetInBlock(endBlock, this.range.end.inlineId, this.range.end.position)
        
        const startTextPos = startBlock.position.start + startOffset
        const endTextPos = endBlock.position.start + endOffset

        return this.ast.text.slice(startTextPos, endTextPos)
    }

    public paste(text: string): EditEffect | null {
        const hasNewlines = text.includes('\n')
        
        if (!this.range) {
            const context = this.resolveInlineContext()
            if (!context) return null
            
            if (hasNewlines) {
                return this.pasteMultiBlock(text, context.block, context.inline, this.caret.position ?? 0)
            }
            
            const caretPosition = this.caret.position ?? 0
            const currentText = context.inline.text.symbolic
            const newText = currentText.slice(0, caretPosition) + text + currentText.slice(caretPosition)
            const newCaretPosition = caretPosition + text.length

            return {
                preventDefault: true,
                ast: [{
                    type: 'input',
                    blockId: context.block.id,
                    inlineId: context.inline.id,
                    text: newText,
                    caretPosition: newCaretPosition,
                }],
            }
        }
        
        if (this.range.start.blockId !== this.range.end.blockId) {
            return null
        }
        
        const startBlock = this.ast.query.getBlockById(this.range.start.blockId)
        const startInline = this.ast.query.getInlineById(this.range.start.inlineId)
        if (!startBlock || !startInline) return null
        
        if (hasNewlines) {
            return this.pasteMultiBlock(text, startBlock, startInline, this.range.start.position, {
                inlineId: this.range.end.inlineId,
                position: this.range.end.position
            })
        }
        
        const startInlineIndex = startBlock.inlines.findIndex(i => i.id === startInline.id)
        const endInline = this.ast.query.getInlineById(this.range.end.inlineId)
        if (!endInline) return null
        
        if (startInline.id === endInline.id) {
            const currentText = startInline.text.symbolic
            const newText = currentText.slice(0, this.range.start.position) + text + currentText.slice(this.range.end.position)
            const newCaretPosition = this.range.start.position + text.length

            return {
                preventDefault: true,
                ast: [{
                    type: 'input',
                    blockId: startBlock.id,
                    inlineId: startInline.id,
                    text: newText,
                    caretPosition: newCaretPosition,
                }],
            }
        }
        
        const endInlineIndex = startBlock.inlines.findIndex(i => i.id === endInline.id)
        
        const textBefore = startBlock.inlines
            .slice(0, startInlineIndex)
            .map(i => i.text.symbolic)
            .join('') + startInline.text.symbolic.slice(0, this.range.start.position)
        
        const textAfter = endInline.text.symbolic.slice(this.range.end.position) +
            startBlock.inlines
                .slice(endInlineIndex + 1)
                .map(i => i.text.symbolic)
                .join('')
        
        const newText = textBefore + text + textAfter
        const newCaretPosition = this.range.start.position + text.length

        return {
            preventDefault: true,
            ast: [{
                type: 'input',
                blockId: startBlock.id,
                inlineId: startInline.id,
                text: newText,
                caretPosition: newCaretPosition,
            }],
        }
    }

    private pasteMultiBlock(
        text: string,
        block: Block,
        inline: Inline,
        startPosition: number,
        endRange?: { inlineId: string; position: number }
    ): EditEffect | null {
        const endPosition = endRange ? endRange.position : undefined
        
        return {
            preventDefault: true,
            ast: [{
                type: 'pasteMultiBlock',
                blockId: block.id,
                inlineId: inline.id,
                text: text,
                startPosition: startPosition,
                endPosition: endPosition,
            }],
        }
    }
}

export default Select
