import Ast from './ast/ast'
import Caret from './caret'
import Render from './render'
import Timeline from './timeline'
import { EditEffect, Executors, AstApplyEffect, AstEffectMap } from '../types'

class Editor {
    private executors: Executors = {
        input: (effect) => this.ast.input(effect.blockId, effect.inlineId, effect.text, effect.caretPosition),
        splitBlock: (effect) => this.ast.split(effect.blockId, effect.inlineId, effect.caretPosition),
        splitListItem: (effect) => this.ast.splitListItem(effect.listItemId, effect.blockId, effect.inlineId, effect.caretPosition),
        mergeInline: (effect) => this.ast.mergeInline(effect.leftInlineId, effect.rightInlineId),
        indentListItem: (effect) => this.ast.indentListItem(effect.listItemId),
        outdentListItem: (effect) => this.ast.outdentListItem(effect.listItemId),
        mergeTableCell: (effect) => this.ast.mergeTableCell(effect.cellId),
        addTableColumn: (effect) => this.ast.addTableColumn(effect.cellId),
        addTableRow: (effect) => this.ast.addTableRow(effect.cellId),
        addTableRowAbove: (effect) => this.ast.addTableRowAbove(effect.cellId),
        splitTableCell: (effect) => this.ast.splitTableCell(effect.cellId, effect.blockId, effect.inlineId, effect.caretPosition),
        splitTableCellAtCaret: (effect) => this.ast.splitTableCellAtCaret(effect.cellId, effect.blockId, effect.inlineId, effect.caretPosition),
        mergeBlocksInCell: (effect) => this.ast.mergeBlocksInCell(effect.cellId, effect.blockId),
        mergeInlineInCell: (effect) => this.ast.mergeInlineInCell(effect.cellId, effect.leftInlineId, effect.rightInlineId),
        insertParagraphAboveTable: (effect) => this.ast.insertParagraphAboveTable(effect.tableId),
        insertParagraphBelowTable: (effect) => this.ast.insertParagraphBelowTable(effect.tableId),
    }
    public emitChange: () => void
    public timeline: Timeline

    constructor(
        public ast: Ast,
        public caret: Caret,
        public render: Render,
        emitChange: () => void
    ) {
        this.emitChange = emitChange
        this.timeline = new Timeline(this, this.snapshot())
    }

    private execute<K extends keyof AstEffectMap>(effect: AstEffectMap[K]): AstApplyEffect | null {
        const execute = this.executors[effect.type]
        return execute(effect)
    }

    private snapshot() {
        return {
            text: this.ast.text,
            blocks: this.ast.blocks,
            caret: {
                blockId: this.caret.blockId ?? '',
                inlineId: this.caret.inlineId ?? '',
                position: this.caret.position ?? 0,
                affinity: this.caret.affinity ?? 'start',
            },
        }
    }

    public undo() {
        this.timeline.undo()
    }

    public redo() {
        this.timeline.redo()
    }

    public apply(effect: EditEffect) {
        this.timeline.push(this.snapshot())

        if (!effect.ast) return

        for (const astEffect of effect.ast) {
            const result = this.execute(astEffect)
            if (!result) continue

            const { renderEffect, caretEffect } = result

            this.ast.normalize()
            this.render.apply(renderEffect)
            this.caret.apply(caretEffect)
            this.emitChange()
        }

        this.timeline.updateEvent(this.snapshot())
    }
}

export default Editor
