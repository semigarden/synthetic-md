import type { Block } from './block'
import type { RenderPosition } from './common'

type AstEffect = 
    | { type: 'input'; blockId: string; inlineId: string; text: string; caretPosition: number }
    | { type: 'splitBlock'; blockId: string; inlineId: string; caretPosition: number }
    | { type: 'splitListItem'; listItemId: string; blockId: string; inlineId: string; caretPosition: number }
    | { type: 'splitTaskListItem'; taskListItemId: string; blockId: string; inlineId: string; caretPosition: number }
    | { type: 'splitBlockQuote'; blockQuoteId: string; blockId: string; inlineId: string; caretPosition: number }
    | { type: 'splitCodeBlockFromMarker'; blockId: string; inlineId: string; caretPosition: number }
    | { type: 'mergeInline'; leftInlineId: string; rightInlineId: string }
    | { type: 'indentListItem'; listItemId: string }
    | { type: 'indentTaskListItem'; taskListItemId: string }
    | { type: 'indentBlockQuote'; blockQuoteId: string, blockId: string, inlineId: string }
    | { type: 'outdentListItem'; listItemId: string }
    | { type: 'outdentTaskListItem'; taskListItemId: string }
    | { type: 'outdentBlockQuote'; blockQuoteId: string, blockId: string, inlineId: string }
    | { type: 'mergeTableCell'; cellId: string }
    | { type: 'addTableColumn'; cellId: string }
    | { type: 'addTableRow'; cellId: string }
    | { type: 'addTableRowAbove'; cellId: string }
    | { type: 'splitTableCell'; cellId: string; blockId: string; inlineId: string; caretPosition: number }
    | { type: 'splitTableCellAtCaret'; cellId: string; blockId: string; inlineId: string; caretPosition: number }
    | { type: 'mergeBlocksInCell'; cellId: string; blockId: string }
    | { type: 'mergeInlineInCell'; cellId: string; leftInlineId: string; rightInlineId: string }
    | { type: 'insertParagraphAboveTable'; tableId: string }
    | { type: 'insertParagraphBelowTable'; tableId: string }
    | { type: 'pasteMultiBlock'; blockId: string; inlineId: string; text: string; startPosition: number; endPosition?: number }
    | { type: 'deleteMultiBlock'; startBlockId: string; startInlineId: string; startPosition: number; endBlockId: string; endInlineId: string; endPosition: number }
    | { type: 'toggleTask'; blockId: string; inlineId: string; caretPosition: number }

export type AstEffectMap = {
    [K in AstEffect['type']]: Extract<AstEffect, { type: K }>
}

export type Executors = {
    [K in keyof AstEffectMap]: (effect: AstEffectMap[K]) => AstApplyEffect | null
}

export type RenderInsert = {
    at: RenderPosition
    target: Block
    current: Block
}

export type Render = {
    remove: Block[]
    insert: RenderInsert[]
}

export type RenderEffect = {
    type: 'update'
    render: Render
}

export type CaretEffect = { 
    type: 'restore'
    caret: {
        blockId: string
        inlineId: string
        position: number
        affinity?: 'start' | 'end'
    }
}

export type AstApplyEffect = {
    renderEffect: RenderEffect
    caretEffect: CaretEffect
}

export type EditEffect = {
    preventDefault?: boolean
    ast?: AstEffect[]
}
