import Ast from './ast/ast'
import Caret from './caret'
import Select from './select/select'
import { SelectionRange, EditEffect, InputEvent } from '../types'

class Input {
    constructor(
        public ast: Ast,
        public caret: Caret,
        public select: Select,
    ) {}

    public resolveEffect(event: InputEvent): EditEffect | null {
        const isInsert = event.type.startsWith('insert')
        const isDelete = event.type.startsWith('delete')
        if (!isInsert && !isDelete) return null
    
        const range = this.select?.resolveRange()
        if (!range) return null

        const isCollapsed = range.start.blockId === range.end.blockId &&
            range.start.inlineId === range.end.inlineId &&
            range.start.position === range.end.position

        if (isInsert) {
            return this.resolveInsert(event.text, range)
        } else if (isDelete) {
            if (!isCollapsed) {
                return this.resolveInsert('', range)
            } else {
                const direction = event.type.includes('Backward') ? 'backward' : 'forward'
                return this.resolveDelete(direction, range)
            }
        }

        return null
    }

    private resolveInsert(text: string, range: SelectionRange): EditEffect | null {
        if (range.start.blockId !== range.end.blockId) {
            return this.resolveMultiBlockInsert(text, range)
        }

        const block = this.ast.query.getBlockById(range.start.blockId)
        if (!block) return null

        const inline = this.ast.query.getInlineById(range.start.inlineId)
        if (!inline) return null

        const startInlineIndex = block.inlines.findIndex(i => i.id === inline.id)
        const endInline = this.ast.query.getInlineById(range.end.inlineId)
        if (!endInline) return null

        if (inline.id === endInline.id) {
            const currentText = inline.text.symbolic
            const newText = currentText.slice(0, range.start.position) + text + currentText.slice(range.end.position)
            const newCaretPosition = range.start.position + text.length

            return {
                preventDefault: true,
                ast: [{
                    type: 'input',
                    blockId: block.id,
                    inlineId: inline.id,
                    text: newText,
                    caretPosition: newCaretPosition,
                }],
            }
        }

        const endInlineIndex = block.inlines.findIndex(i => i.id === endInline.id)
        
        const textBefore = block.inlines
            .slice(0, startInlineIndex)
            .map(i => i.text.symbolic)
            .join('') + inline.text.symbolic.slice(0, range.start.position)
        
        const textAfter = endInline.text.symbolic.slice(range.end.position) +
            block.inlines
                .slice(endInlineIndex + 1)
                .map(i => i.text.symbolic)
                .join('')
        
        const newText = textBefore + text + textAfter
        const newCaretPosition = textBefore.length + text.length

        return {
            preventDefault: true,
            ast: [{
                type: 'input',
                blockId: block.id,
                inlineId: inline.id,
                text: newText,
                caretPosition: newCaretPosition,
            }],
        }
    }

    private resolveMultiBlockInsert(text: string, range: SelectionRange): EditEffect | null {
        const startBlock = this.ast.query.getBlockById(range.start.blockId)
        const startInline = this.ast.query.getInlineById(range.start.inlineId)
        if (!startBlock || !startInline) return null

        const endBlock = this.ast.query.getBlockById(range.end.blockId)
        const endInline = this.ast.query.getInlineById(range.end.inlineId)
        if (!endBlock || !endInline) return null

        if (text === '') {
            return {
                preventDefault: true,
                ast: [{
                    type: 'deleteMultiBlock',
                    startBlockId: startBlock.id,
                    startInlineId: startInline.id,
                    startPosition: range.start.position,
                    endBlockId: endBlock.id,
                    endInlineId: endInline.id,
                    endPosition: range.end.position,
                }],
            }
        }

        return this.select.paste(text)
    }

    private resolveDelete(direction: 'backward' | 'forward', range: SelectionRange): EditEffect | null {
        const block = this.ast.query.getBlockById(range.start.blockId)
        if (!block) return null

        const inline = this.ast.query.getInlineById(range.start.inlineId)
        if (!inline) return null

        inline.text.symbolic = inline.text.symbolic
            .replace(/[\u200B\u200C\u200D\uFEFF]/g, '')
            .replace(/\r$/, '')

        if (inline.text.symbolic === '') {
            const list = this.ast.query.getListFromBlock(block)
            const previousInline = list && list.blocks.length > 1 ? this.ast.query.getPreviousInlineInList(inline) ?? this.ast.query.getPreviousInline(inline.id) : this.ast.query.getPreviousInline(inline.id)

            if (previousInline) {
                return {
                    preventDefault: true,
                    ast: [{
                        type: 'mergeInline',
                        leftInlineId: previousInline.id,
                        rightInlineId: inline.id,
                    }],
                }
            }
        }

        const inlineIndex = block.inlines.findIndex(i => i.id === inline.id)

        const position = range.start.position
        const currentText = inline.text.symbolic

        let newText: string
        let newCaretPosition: number

        if (direction === 'backward') {
            if (block.position.start === 0 && inlineIndex === 0 && position === 0) {
                return { preventDefault: true }
            }
            newText = currentText.slice(0, position - 1) + currentText.slice(position)
            newCaretPosition = position - 1
        } else {
            if (position >= currentText.length) {
                return { preventDefault: true }
            }
            newText = currentText.slice(0, position) + currentText.slice(position + 1)
            newCaretPosition = position
        }

        return {
            preventDefault: true,
            ast: [{
                type: 'input',
                blockId: block.id,
                inlineId: inline.id,
                text: newText,
                caretPosition: newCaretPosition,
            }],
        }
    }
}

export default Input
