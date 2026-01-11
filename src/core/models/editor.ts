import Ast from './ast/ast'
import Caret from './caret'
import Render from './render'
import Timeline from './timeline'
import { EditEffect, AstApplyEffect } from '../types'

class Editor {
    public emitChange: () => void
    public timeline: Timeline

    constructor(
        public ast: Ast,
        public caret: Caret,
        public render: Render,
        emitChange: () => void
    ) {
        this.emitChange = emitChange
        this.timeline = new Timeline(this, { text: ast.text, blocks: ast.blocks, caret: { blockId: caret.blockId ?? '', inlineId: caret.inlineId ?? '', position: caret.position ?? 0, affinity: caret.affinity ?? 'start' } })
    }

    public undo() {
        this.timeline.undo()
    }

    public redo() {
        this.timeline.redo()
    }

    public apply(effect: EditEffect) {
        this.timeline.push({ text: this.ast.text, blocks: this.ast.blocks, caret: { blockId: this.caret.blockId ?? '', inlineId: this.caret.inlineId ?? '', position: this.caret.position ?? 0, affinity: this.caret.affinity ?? 'start' } })
        
        if (effect.ast) {
            effect.ast.forEach(effect => {
                let result: AstApplyEffect | null = null
                switch (effect.type) {
                    case 'input':
                        result = this.ast.input(effect.blockId, effect.inlineId, effect.text, effect.caretPosition)
                        break
                    case 'splitBlock':
                        result = this.ast.split(effect.blockId, effect.inlineId, effect.caretPosition)
                        break
                    case 'splitListItem':
                        result = this.ast.splitListItem(effect.listItemId, effect.blockId, effect.inlineId, effect.caretPosition)
                        break
                    case 'mergeInline':
                        result = this.ast.mergeInline(effect.leftInlineId, effect.rightInlineId)
                        break
                    case 'indentListItem':
                        result = this.ast.indentListItem(effect.listItemId)
                        break
                    case 'outdentListItem':
                        result = this.ast.outdentListItem(effect.listItemId)
                        break
                    case 'mergeTableCell':
                        result = this.ast.mergeTableCell(effect.cellId)
                        break
                    case 'addTableColumn':
                        result = this.ast.addTableColumn(effect.cellId)
                        break
                    case 'addTableRow':
                        result = this.ast.addTableRow(effect.cellId)
                        break
                    case 'addTableRowAbove':
                        result = this.ast.addTableRowAbove(effect.cellId)
                        break
                    case 'splitTableCell':
                        result = this.ast.splitTableCell(effect.cellId, effect.blockId, effect.inlineId, effect.caretPosition)
                        break
                    case 'splitTableCellAtCaret':
                        result = this.ast.splitTableCellAtCaret(effect.cellId, effect.blockId, effect.inlineId, effect.caretPosition)
                        break
                    case 'mergeBlocksInCell':
                        result = this.ast.mergeBlocksInCell(effect.cellId, effect.blockId)
                        break
                    case 'mergeInlineInCell':
                        result = this.ast.mergeInlineInCell(effect.cellId, effect.leftInlineId, effect.rightInlineId)
                        break
                    case 'insertParagraphAboveTable':
                        result = this.ast.insertParagraphAboveTable(effect.tableId)
                        break
                    case 'insertParagraphBelowTable':
                        result = this.ast.insertParagraphBelowTable(effect.tableId)
                        break
                }
                if (!result) return

                const { renderEffect, caretEffect } = result

                this.ast.normalize()
                this.render.apply(renderEffect)
                this.caret.apply(caretEffect)
                this.emitChange()
            })
            this.timeline.updateEvent({ text: this.ast.text, blocks: this.ast.blocks, caret: { blockId: this.caret.blockId ?? '', inlineId: this.caret.inlineId ?? '', position: this.caret.position ?? 0, affinity: this.caret.affinity ?? 'start' } })
        }
    }
}

export default Editor
