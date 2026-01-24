import Ast from './ast/ast'
import Caret from './caret'
import Render from './render/render'
import Select from './select/select'
import { BlockQuote, CodeBlock, EditContext, EditEffect, Intent as IntentType } from '../types'

class Intent {
    constructor(
        public ast: Ast,
        public caret: Caret,
        public select: Select,
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
        } else if (intent === 'toggleTask') {
            return this.resolveToggleTask(context)
        } else if (intent === 'exitCodeBlockAbove') {
            return this.resolveExitCodeBlock(context, 'above')
        } else if (intent === 'exitCodeBlockBelow') {
            return this.resolveExitCodeBlock(context, 'below')
        }

        return { preventDefault: false }
    }

    public resolveSplit(context: EditContext): EditEffect {
        const caretPosition = this.caret.getPositionInInline(context.inlineElement)
        const parentBlock = this.ast.query.getParentBlock(context.block)

        if (context.block.type === 'codeBlock') {
            if (context.inline.type === 'marker') {
                return {
                    preventDefault: true,
                    ast: [{
                        type: 'splitCodeBlockFromMarker',
                        blockId: context.block.id,
                        inlineId: context.inline.id,
                        caretPosition: caretPosition,
                    }],
                }
            }

            return {
                preventDefault: true,
                ast: [{
                    type: 'splitCodeBlock',
                    blockId: context.block.id,
                    inlineId: context.inline.id,
                    caretPosition: caretPosition,
                }],
            }
        }

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

        if (parentBlock?.type === 'taskListItem') {
            return {
                preventDefault: true,
                ast: [{
                    type: 'splitTaskListItem',
                    taskListItemId: parentBlock.id,
                    blockId: context.block.id,
                    inlineId: context.inline.id,
                    caretPosition: caretPosition,
                }],
            }
        }

        if (parentBlock?.type === 'blockQuote') {
            return {
                preventDefault: true,
                ast: [{ type: 'splitBlockQuote', blockQuoteId: parentBlock.id, blockId: context.block.id, inlineId: context.inline.id, caretPosition: caretPosition }],
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

        const parentBlock = this.ast.query.getParentBlock(context.block)
        if (parentBlock?.type === 'tableCell' || parentBlock?.type === 'tableHeader') {
            const isFirstInline = context.inlineIndex === 0
            const blockIndex = parentBlock.blocks.findIndex(b => b.id === context.block.id)
            const isFirstBlockInCell = blockIndex === 0

            if (isFirstInline) {
                if (isFirstBlockInCell) {
                    return {
                        preventDefault: true,
                        ast: [{ type: 'mergeTableCell', cellId: parentBlock.id }],
                    }
                } else {
                    return {
                        preventDefault: true,
                        ast: [{ type: 'mergeBlocksInCell', cellId: parentBlock.id, blockId: context.block.id }],
                    }
                }
            } else {
                const previousInline = this.ast.query.getPreviousInlineInBlock(context.inline, context.block)
                if (previousInline) {
                    return {
                        preventDefault: true,
                        ast: [{ type: 'mergeInlineInCell', cellId: parentBlock.id, leftInlineId: previousInline.id, rightInlineId: context.inline.id }],
                    }
                }
            }
        }

        if (parentBlock?.type === 'listItem' || parentBlock?.type === 'taskListItem') {
            const list = this.ast.query.getListFromBlock(parentBlock)
            if (list) {
                const itemIndex = list.blocks.indexOf(parentBlock)
                const isFirstItem = itemIndex === 0

                const parentOfList = this.ast.query.getParentBlock(list)
                const isNestedList = parentOfList?.type === 'listItem' || parentOfList?.type === 'taskListItem'
                
                if (isFirstItem && isNestedList) {
                    if (parentBlock.type === 'listItem') {
                        return {
                            preventDefault: true,
                            ast: [{ type: 'outdentListItem', listItemId: parentBlock.id }],
                        }
                    } else if (parentBlock.type === 'taskListItem') {
                        return {
                            preventDefault: true,
                            ast: [{ type: 'outdentTaskListItem', taskListItemId: parentBlock.id }],
                        }
                    }
                }
            }
        }

        if (parentBlock?.type === 'blockQuote') {
            const quote = parentBlock as BlockQuote
            const quoteParent = this.ast.query.getParentBlock(quote)
            const isNested = quoteParent?.type === 'blockQuote'

            if (!isNested) {
                const firstChild = quote.blocks?.[0] as any
                const isFirstChild = firstChild?.id === context.block.id
                const isFirstInline = firstChild?.inlines?.[0]?.id === context.inline.id

                if (isFirstChild && isFirstInline) {
                    return {
                        preventDefault: true,
                        ast: [{ type: 'outdentBlockQuote', blockQuoteId: quote.id, blockId: context.block.id, inlineId: context.inline.id }],
                    }
                }
            }
        }

        const list = this.ast.query.getListFromBlock(context.block)
        const previousInline = list && list.blocks.length > 1 ? this.ast.query.getPreviousInlineInList(context.inline) ?? this.ast.query.getPreviousInline(context.inline.id) : this.ast.query.getPreviousInline(context.inline.id)

        if (previousInline) {
            // if (previousInline.type === 'marker' && context.block.type === 'codeBlock') {
            //     return {
            //         preventDefault: true,
            //         ast: [{
            //             type: 'mergeCodeBlockContent',
            //             blockId: context.block.id,
            //             inlineId: previousInline.id,
            //             caretPosition: this.caret.getPositionInInline(context.inlineElement),
            //         }],
            //     }
            // }

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
        if (context.block.type === 'codeBlock') {
            const caretPosition = this.caret.getPositionInInline(context.inlineElement)
            const tabSpaces = '  '
            
            const currentText = context.inline.text.symbolic
            const newText = currentText.slice(0, caretPosition) + tabSpaces + currentText.slice(caretPosition)
            const newCaretPosition = caretPosition + tabSpaces.length
            
            return {
                preventDefault: true,
                ast: [{
                    type: 'inputCodeBlock',
                    blockId: context.block.id,
                    inlineId: context.inline.id,
                    text: newText,
                    caretPosition: newCaretPosition,
                }],
            }
        }

        const parentBlock = this.ast.query.getParentBlock(context.block)
        if (parentBlock?.type === 'tableCell' || parentBlock?.type === 'tableHeader') {
            const caretPosition = this.caret.getPositionInInline(context.inlineElement)
            return {
                preventDefault: true,
                ast: [{
                    type: 'splitTableCellAtCaret',
                    cellId: parentBlock.id,
                    blockId: context.block.id,
                    inlineId: context.inline.id,
                    caretPosition: caretPosition,
                }],
            }
        }

        if (!parentBlock || (parentBlock.type !== 'listItem' && parentBlock.type !== 'taskListItem' && parentBlock.type !== 'blockQuote')) return { preventDefault: false }

        if (parentBlock.type === 'taskListItem') {
            return {
                preventDefault: true,
                ast: [{ type: 'indentTaskListItem', taskListItemId: parentBlock.id }],
            }
        }

        if (parentBlock.type === 'blockQuote') {
            return {
                preventDefault: true,
                ast: [{ type: 'indentBlockQuote', blockQuoteId: parentBlock.id, blockId: context.block.id, inlineId: context.inline.id }],
            }
        }

        return {
            preventDefault: true,
            ast: [{ type: 'indentListItem', listItemId: parentBlock.id }],
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
        if (!listItem || (listItem.type !== 'listItem' && listItem.type !== 'taskListItem' && listItem.type !== 'blockQuote')) return { preventDefault: false }

        const blockQuote = this.ast.query.getParentBlock(context.block)
        if (blockQuote?.type === 'blockQuote') {
            return {
                preventDefault: true,
                ast: [{ type: 'outdentBlockQuote', blockQuoteId: blockQuote.id, blockId: context.block.id, inlineId: context.inline.id }],
            }
        }

        if (listItem.type === 'listItem') {
            return {
                preventDefault: true,
                ast: [{ type: 'outdentListItem', listItemId: listItem.id }],
            }
        } else if (listItem.type === 'taskListItem') {
            return {
                preventDefault: true,
                ast: [{ type: 'outdentTaskListItem', taskListItemId: listItem.id }],
            }
        }

        return { preventDefault: false }
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

    private resolveToggleTask(context: EditContext): EditEffect {
        return {
            preventDefault: true,
            ast: [{ type: 'toggleTask', blockId: context.block.id, inlineId: context.inline.id, caretPosition: this.caret.getPositionInInline(context.inlineElement) }],
        }
    }

    private resolveExitCodeBlock(context: EditContext, direction: 'above' | 'below'): EditEffect {
        if (context.block.type !== 'codeBlock') {
            return { preventDefault: false }
        }

        return {
            preventDefault: true,
            ast: [{
                type: 'exitCodeBlock',
                blockId: context.block.id,
                direction: direction,
            }],
        }
    }
}

export default Intent
