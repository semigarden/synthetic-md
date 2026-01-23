import Ast from './ast/ast'
import Caret from './caret'
import Render from './render/render'
import Timeline from './timeline'
import { EditEffect, Executors, AstApplyEffect, AstEffectMap } from '../types'

class Editor {
    private executors: Executors = {
        input: (effect) => this.ast.input(effect.blockId, effect.inlineId, effect.text, effect.caretPosition),
        splitBlock: (effect) => this.ast.split(effect.blockId, effect.inlineId, effect.caretPosition),
        splitListItem: (effect) => this.ast.splitListItem(effect.listItemId, effect.blockId, effect.inlineId, effect.caretPosition),
        splitTaskListItem: (effect) => this.ast.splitTaskListItem(effect.taskListItemId, effect.blockId, effect.inlineId, effect.caretPosition),
        splitBlockQuote: (effect) => this.ast.splitBlockQuote(effect.blockQuoteId, effect.blockId, effect.inlineId, effect.caretPosition),
        splitCodeBlockFromMarker: (effect) => this.ast.splitCodeBlockFromMarker(effect.blockId, effect.inlineId, effect.caretPosition),
        mergeInline: (effect) => this.ast.mergeInline(effect.leftInlineId, effect.rightInlineId),
        indentListItem: (effect) => this.ast.indentListItem(effect.listItemId),
        indentTaskListItem: (effect) => this.ast.indentTaskListItem(effect.taskListItemId),
        indentBlockQuote: (effect) => this.ast.indentBlockQuote(effect.blockQuoteId, effect.blockId, effect.inlineId),
        outdentListItem: (effect) => this.ast.outdentListItem(effect.listItemId),
        outdentTaskListItem: (effect) => this.ast.outdentTaskListItem(effect.taskListItemId),
        outdentBlockQuote: (effect) => this.ast.outdentBlockQuote(effect.blockQuoteId, effect.blockId, effect.inlineId),
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
        pasteMultiBlock: (effect) => this.ast.pasteMultiBlock(effect.blockId, effect.inlineId, effect.text, effect.startPosition, effect.endPosition),
        deleteMultiBlock: (effect) => this.ast.deleteMultiBlock(effect.startBlockId, effect.startInlineId, effect.startPosition, effect.endBlockId, effect.endInlineId, effect.endPosition),
        toggleTask: (effect) => this.ast.toggleTask(effect.blockId, effect.inlineId, effect.caretPosition),
        inputCodeBlock: (effect) => this.ast.inputCodeBlock(effect.blockId, effect.inlineId, effect.text, effect.caretPosition),
        splitCodeBlock: (effect) => this.ast.splitCodeBlock(effect.blockId, effect.inlineId, effect.caretPosition),
        mergeCodeBlockContent: (effect) => this.ast.mergeCodeBlockContent(effect.blockId, effect.inlineId, effect.caretPosition),
        exitCodeBlock: (effect) => this.ast.exitCodeBlock(effect.blockId, effect.direction),
        unwrapCodeBlock: (effect) => this.ast.unwrapCodeBlock(effect.blockId),
        setCodeBlockLanguage: (effect) => this.ast.setCodeBlockLanguage(effect.blockId, effect.language),
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
