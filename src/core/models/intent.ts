import Ast from './ast/ast'
import Caret from './caret'
import Render from './render'
import Selection from './selection'
import { EditContext, EditEffect, Intent as IntentType } from '../types'

class Intent {
    constructor(
        public ast: Ast,
        public caret: Caret,
        public selection: Selection,
        public render: Render,
    ) {}

    public resolveEffect(intent: IntentType, context: EditContext): EditEffect {
        if (intent === 'split') {
            return this.resolveSplit(context)
        } else if (intent === 'merge') {
            return this.resolveMerge(context)
        } else if (intent === 'indent') {
            return this.resolveIndent(context)
        } else if (intent === 'outdent') {
            return this.resolveOutdent(context)
        } else if (intent === 'insertRowAbove') {
            return this.resolveInsertRowAbove(context)
        } else if (intent === 'splitInCell') {
            return this.resolveSplitInCell(context)
        }

        return { preventDefault: false }
    }

    public resolveInput(context: EditContext): EditEffect {
        console.log('resolveInput', context.inlineElement.textContent)
        const caretPosition = this.caret.getPositionInInline(context.inlineElement)

        return {
            preventDefault: false,
            ast: [{
                type: 'input',
                blockId: context.block.id,
                inlineId: context.inline.id,
                text: context.inlineElement.textContent ?? '',
                caretPosition: caretPosition,
            }],
        }
    }

    public resolveSplit(context: EditContext): EditEffect {
        const caretPosition = this.caret.getPositionInInline(context.inlineElement)
        
        const parentBlock = this.ast.query.getParentBlock(context.block)

        if (parentBlock?.type === 'tableCell' || parentBlock?.type === 'tableHeader') {
            return {
                preventDefault: true,
                ast: [{
                    type: 'addTableRow',
                    cellId: parentBlock.id,
                }],
            }
        }

        if (parentBlock?.type === 'listItem') {
            return {
                preventDefault: true,
                ast: [{
                    type: 'splitListItem',
                    listItemId: parentBlock.id,
                    blockId: context.block.id,
                    inlineId: context.inline.id,
                    caretPosition: caretPosition,
                }],
            }
        }

        return {
            preventDefault: true,
            ast: [{
                type: 'splitBlock',
                blockId: context.block.id,
                inlineId: context.inline.id,
                caretPosition: caretPosition,
            }],
        }
    }

    private resolveMerge(context: EditContext): EditEffect {
        if (this.caret.getPositionInInline(context.inlineElement) !== 0) return { preventDefault: false }

        const tableCell = this.ast.query.getParentBlock(context.block)
        if (tableCell?.type === 'tableCell' || tableCell?.type === 'tableHeader') {
            const isFirstInline = context.inlineIndex === 0
            const blockIndex = tableCell.blocks.findIndex(b => b.id === context.block.id)
            const isFirstBlockInCell = blockIndex === 0

            if (isFirstInline) {
                if (isFirstBlockInCell) {
                    return {
                        preventDefault: true,
                        ast: [{ type: 'mergeTableCell', cellId: tableCell.id }],
                    }
                } else {
                    return {
                        preventDefault: true,
                        ast: [{ type: 'mergeBlocksInCell', cellId: tableCell.id, blockId: context.block.id }],
                    }
                }
            } else {
                const previousInline = this.ast.query.getPreviousInlineInBlock(context.inline, context.block)
                if (previousInline) {
                    return {
                        preventDefault: true,
                        ast: [{ type: 'mergeInlineInCell', cellId: tableCell.id, leftInlineId: previousInline.id, rightInlineId: context.inline.id }],
                    }
                }
            }
        }

        const listItem = this.ast.query.getParentBlock(context.block)
        if (listItem?.type === 'listItem') {
            const list = this.ast.query.getListFromBlock(listItem)
            if (list) {
                const itemIndex = list.blocks.indexOf(listItem)
                const isFirstItem = itemIndex === 0

                const parentOfList = this.ast.query.getParentBlock(list)
                const isNestedList = parentOfList?.type === 'listItem'
                
                if (isFirstItem && isNestedList) {
                    return {
                        preventDefault: true,
                        ast: [{ type: 'outdentListItem', listItemId: listItem.id }],
                    }
                }
            }
        }

        const list = this.ast.query.getListFromBlock(context.block)
        const previousInline = list && list.blocks.length > 1 ? this.ast.query.getPreviousInlineInList(context.inline) ?? this.ast.query.getPreviousInline(context.inline.id) : this.ast.query.getPreviousInline(context.inline.id)

        if (previousInline) {
            return {
                preventDefault: true,
                ast: [{
                    type: 'mergeInline',
                    leftInlineId: previousInline.id,
                    rightInlineId: context.inline.id,
                }],
            }
        }

        return { preventDefault: false }
    }

    private resolveIndent(context: EditContext): EditEffect {
        const tableCell = this.ast.query.getParentBlock(context.block)
        if (tableCell?.type === 'tableCell' || tableCell?.type === 'tableHeader') {
            const caretPosition = this.caret.getPositionInInline(context.inlineElement)
            return {
                preventDefault: true,
                ast: [{
                    type: 'splitTableCellAtCaret',
                    cellId: tableCell.id,
                    blockId: context.block.id,
                    inlineId: context.inline.id,
                    caretPosition: caretPosition,
                }],
            }
        }

        const listItem = this.ast.query.getParentBlock(context.block)
        if (!listItem || listItem.type !== 'listItem') return { preventDefault: false }

        return {
            preventDefault: true,
            ast: [{ type: 'indentListItem', listItemId: listItem.id }],
        }
    }

    private resolveOutdent(context: EditContext): EditEffect {
        const tableCell = this.ast.query.getParentBlock(context.block)
        if (tableCell?.type === 'tableHeader') {
            const tableRow = this.ast.query.getParentBlock(tableCell)
            if (tableRow?.type === 'tableRow') {
                const table = this.ast.query.getParentBlock(tableRow)
                if (table?.type === 'table') {
                    const tableIndex = this.ast.blocks.findIndex(b => b.id === table.id)
                    if (tableIndex >= 0) {
                        return {
                            preventDefault: true,
                            ast: [{
                                type: 'insertParagraphAboveTable',
                                tableId: table.id,
                            }],
                        }
                    }
                }
            }
        }

        if (tableCell?.type === 'tableCell' || tableCell?.type === 'tableHeader') {
            const tableRow = this.ast.query.getParentBlock(tableCell)
            if (tableRow?.type === 'tableRow') {
                const table = this.ast.query.getParentBlock(tableRow)
                if (table?.type === 'table') {
                    const isLastRow = table.blocks[table.blocks.length - 1]?.id === tableRow.id
                    if (isLastRow) {
                        const tableIndex = this.ast.blocks.findIndex(b => b.id === table.id)
                        if (tableIndex >= 0) {
                            return {
                                preventDefault: true,
                                ast: [{
                                    type: 'insertParagraphBelowTable',
                                    tableId: table.id,
                                }],
                            }
                        }
                    }
                }
            }
        }

        const listItem = this.ast.query.getParentBlock(context.block)
        if (!listItem || listItem.type !== 'listItem') return { preventDefault: false }

        return {
            preventDefault: true,
            ast: [{ type: 'outdentListItem', listItemId: listItem.id }],
        }
    }

    private resolveInsertRowAbove(context: EditContext): EditEffect {
        const tableCell = this.ast.query.getParentBlock(context.block)
        if (tableCell?.type !== 'tableCell' && tableCell?.type !== 'tableHeader') return { preventDefault: false }

        return {
            preventDefault: true,
            ast: [{ type: 'addTableRowAbove', cellId: tableCell.id }],
        }
    }

    private resolveSplitInCell(context: EditContext): EditEffect {
        const tableCell = this.ast.query.getParentBlock(context.block)
        if (tableCell?.type !== 'tableCell' && tableCell?.type !== 'tableHeader') return { preventDefault: false }

        const caretPosition = this.caret.getPositionInInline(context.inlineElement)

        return {
            preventDefault: true,
            ast: [{
                type: 'splitTableCell',
                cellId: tableCell.id,
                blockId: context.block.id,
                inlineId: context.inline.id,
                caretPosition: caretPosition,
            }],
        }
    }
}

export default Intent
