import { detectBlockType } from '../parse/block/blockDetect'
import { uuid } from '../../utils/utils'
import type { AstContext } from './astContext'
import type { AstApplyEffect, Block, Inline, List, ListItem, Table, TableRow, TableHeader, TableCell } from '../../types'

class Edit {
    constructor(private context: AstContext) {}

    public input(blockId: string, inlineId: string, text: string, caretPosition: number): AstApplyEffect | null {
        const { query, parser, transform, effect } = this.context
        
        const block = query.getBlockById(blockId)
        if (!block) return null

        const inline = query.getInlineById(inlineId)
        if (!inline) return null

        const inlineIndex = block.inlines.findIndex(i => i.id === inlineId)
        const absoluteCaretPosition =
            block.inlines
                .slice(0, inlineIndex)
                .reduce((sum, i) => sum + i.text.symbolic.length, 0)
            + caretPosition

        const newText = block.inlines.slice(0, inlineIndex).map(i => i.text.symbolic).join('') + text + block.inlines.slice(inlineIndex + 1).map(i => i.text.symbolic).join('')
        const detectedBlock = detectBlockType(newText)

        const blockTypeChanged =
            detectedBlock.type !== block.type ||
            (detectedBlock.type === 'heading' && block.type === 'heading' && detectedBlock.level !== block.level)
        
        const ignoreTypes = ['blankLine', 'codeBlock', 'table']
        if (blockTypeChanged && !ignoreTypes.includes(detectedBlock.type)) {
            if (detectedBlock.type === 'listItem') caretPosition = 0
            return transform.transformBlock(newText, block, detectedBlock, caretPosition)
        }

        if (block.type === 'paragraph' && this.isTableDivider(newText)) {
            const prevBlock = this.getPreviousBlock(block)
            if (prevBlock?.type === 'paragraph' && this.isTableHeader(prevBlock.text)) {
                return this.mergeIntoTable(prevBlock, block, newText)
            }
        }
        
        const newInlines = parser.inline.parseInline(newText, block.id, block.type, block.position.start)
        const hit = query.getInlineAtPosition(newInlines, absoluteCaretPosition)
        const newInline = hit?.inline
        const position = hit?.position ?? 0
        if (!newInline) return null

        block.text = newInlines.map((i: Inline) => i.text.symbolic).join('')
        block.position = { start: block.position.start, end: block.position.start + block.text.length }
        block.inlines = newInlines
        newInlines.forEach((i: Inline) => (i.blockId = block.id))

        return effect.compose(
            effect.update([{ at: 'current', target: block, current: block }]),
            effect.caret(block.id, newInline.id, position, 'start')
        )
    }

    public split(blockId: string, inlineId: string, caretPosition: number): AstApplyEffect | null {
        const { ast, query, parser, mutation, effect } = this.context

        const block = query.getBlockById(blockId)
        if (!block) return null

        const result = mutation.splitBlockPure(block, inlineId, caretPosition)
        if (!result) return null

        const { left, right } = result

        const newLeft = parser.reparseTextFragment(left.text, left.position.start)
        const newRight = parser.reparseTextFragment(right.text, right.position.start)

        const index = ast.blocks.findIndex(b => b.id === block.id)
        ast.blocks.splice(index, 1, ...newLeft, ...newRight)

        return effect.compose(
            effect.update([
                { at: 'current', target: left, current: newLeft[0] },
                { at: 'next', target: newLeft[0], current: newRight[0] },
            ]),
            effect.caret(newRight[0].id, newRight[0].inlines[0].id, 0, 'start')
        )
    }

    public mergeInline(inlineAId: string, inlineBId: string): AstApplyEffect | null {
        const { ast, query, mutation, transform, effect } = this.context

        const flattened = query.flattenInlines(ast.blocks)
        const iA = flattened.findIndex(i => i.inline.id === inlineAId)
        const iB = flattened.findIndex(i => i.inline.id === inlineBId)
        if (iA === -1 || iB === -1) return null

        const [leftInline, rightInline] = iA < iB ? [flattened[iA].inline, flattened[iB].inline] : [flattened[iB].inline, flattened[iA].inline]

        const result = mutation.mergeInlinePure(leftInline, rightInline)

        if (!result) return null

        const { leftBlock, mergedInline, removedBlock } = result

        let removedBlocks: Block[] = []
        if (removedBlock) {
            removedBlocks = mutation.removeBlockCascade(removedBlock)
        }

        const caretPositionInMergedInline = removedBlock ? leftInline.text.symbolic.length : leftInline.text.symbolic.length - 1
        const caretPosition = leftBlock.inlines
            .slice(0, leftBlock.inlines.findIndex(i => i.id === mergedInline.id))
            .reduce((s, i) => s + i.text.symbolic.length, 0)
        + caretPositionInMergedInline

        const newText = leftBlock.inlines.map(i => i.text.symbolic).join('')
        const detectedBlock = detectBlockType(newText)

        const blockTypeChanged =
            detectedBlock.type !== leftBlock.type ||
            (detectedBlock.type === 'heading' && leftBlock.type === 'heading' && detectedBlock.level !== leftBlock.level)

        const ignoreTypes = ['blankLine', 'codeBlock', 'table']
        if (blockTypeChanged && !ignoreTypes.includes(detectedBlock.type)) {
            return transform.transformBlock(newText, leftBlock, detectedBlock, caretPosition, removedBlocks)
        }

        return effect.compose(
            effect.update([{ at: 'current', target: leftBlock, current: leftBlock }], removedBlocks),
            effect.caret(leftBlock.id, mergedInline.id, caretPositionInMergedInline, 'start')
        )
    }

    public splitListItem(listItemId: string, blockId: string, inlineId: string, caretPosition: number): AstApplyEffect | null {
        const { query, parser, mutation, effect } = this.context

        const listItem = query.getBlockById(listItemId) as ListItem
        if (!listItem) return null

        const list = query.getParentBlock(listItem) as List
        if (!list) return null

        const block = listItem.blocks.find(b => b.id === blockId)
        if (!block) return null

        const result = mutation.splitBlockPure(block, inlineId, caretPosition)
        if (!result) return null

        const { left, right } = result

        const newLeft = parser.reparseTextFragment(left.text, left.position.start)
        const newRight = parser.reparseTextFragment(right.text, right.position.start)

        listItem.blocks = newLeft

        const index = list.blocks.findIndex(b => b.id === listItem.id)
        listItem.text = query.getListItemText(listItem, list)

        const newListItem: ListItem = {
            id: uuid(),
            type: 'listItem',
            blocks: [],
            inlines: [],
            text: '',
            position: {
                start: listItem.position.end,
                end: listItem.position.end,
            },
        }

        const marker = query.getListItemMarker(list, index + 1)

        newListItem.inlines.unshift({
            id: uuid(),
            type: 'marker',
            text: {
                symbolic: marker,
                semantic: '',
            },
            position: { start: 0, end: marker.length },
        } as Inline)

        const bodyText = newRight
            .map(b => b.inlines.map(i => i.text.symbolic).join(''))
            .join('')

        const bodyBlocks = parser.reparseTextFragment(
            bodyText,
            newListItem.position.start + marker.length
        )

        newListItem.text = marker
        newListItem.blocks = bodyBlocks

        list.blocks.splice(index + 1, 0, newListItem)

        return effect.compose(
            effect.update([
                { at: 'current', target: listItem, current: listItem },
                { at: 'next', target: listItem, current: newListItem },
            ]),
            effect.caret(newListItem.blocks[0].id, newListItem.blocks[0].inlines[0].id, 0, 'start')
        )
    }

    public indentListItem(listItemId: string): AstApplyEffect | null {
        const { query, effect } = this.context

        const listItem = query.getBlockById(listItemId) as ListItem
        if (!listItem) return null
    
        const list = query.getListFromBlock(listItem)
        if (!list) return null
    
        const index = list.blocks.indexOf(listItem)
        if (index === 0) return null
    
        const prev = list.blocks[index - 1] as ListItem
    
        let sublist = prev.blocks.find(b => b.type === 'list') as List | undefined
        if (!sublist) {
            sublist = {
                id: uuid(),
                type: 'list',
                ordered: list.ordered,
                listStart: list.listStart,
                tight: list.tight,
                blocks: [],
                inlines: [],
                text: '',
                position: { start: 0, end: 0 },
            }
            prev.blocks.push(sublist)
        }

        const oldId = listItem.id
        list.blocks.splice(index, 1)
        listItem.id = uuid()
        sublist.blocks.push(listItem)

        return effect.compose(
            effect.update([{ at: 'current', target: prev, current: prev }], [{ ...listItem, id: oldId }]),
            effect.caret(listItem.id, listItem.blocks[0].inlines[0].id, 0, 'start')
        )
    }

    public outdentListItem(listItemId: string): AstApplyEffect | null {
        const { ast, query, parser, effect } = this.context

        const listItem = query.getBlockById(listItemId) as ListItem
        if (!listItem) return null

        const sublist = query.getListFromBlock(listItem)
        if (!sublist) return null

        const parentListItem = query.getParentBlock(sublist) as ListItem | null
        
        if (!parentListItem || parentListItem.type !== 'listItem') {
            const flat = query.flattenBlocks(ast.blocks)
            const listEntry = flat.find(b => b.block.id === sublist.id)
            if (!listEntry) return null

            const listIndex = ast.blocks.findIndex(b => b.id === sublist.id)
            const itemIndex = sublist.blocks.indexOf(listItem)

            const itemsBefore = sublist.blocks.slice(0, itemIndex)
            const itemsAfter = sublist.blocks.slice(itemIndex + 1)

            const contentBlocks = listItem.blocks.filter(b => b.type !== 'list')
            const nestedList = listItem.blocks.find(b => b.type === 'list') as List | undefined

            const blocksToInsert: Block[] = []
            const blocksToRemove: Block[] = []
            const insertEffects: Array<{ at: 'current' | 'next'; target: Block; current: Block }> = []

            if (contentBlocks.length > 0) {
                contentBlocks.forEach(block => {
                    const newBlock: Block = {
                        ...block,
                        id: uuid(),
                    }
                    newBlock.inlines = newBlock.inlines.map(inline => ({
                        ...inline,
                        blockId: newBlock.id,
                    }))
                    blocksToInsert.push(newBlock)
                })
            } else {
                const emptyParagraph: Block = {
                    id: uuid(),
                    type: 'paragraph',
                    text: '',
                    position: { start: 0, end: 0 },
                    inlines: [],
                }
                emptyParagraph.inlines = parser.inline.parseInline('', emptyParagraph.id, 'paragraph', 0)
                emptyParagraph.inlines.forEach((i: Inline) => i.blockId = emptyParagraph.id)
                blocksToInsert.push(emptyParagraph)
            }

            if (nestedList) {
                const newNestedList: List = {
                    ...nestedList,
                    id: uuid(),
                }
                blocksToInsert.push(newNestedList)
            }

            if (itemsBefore.length > 0 && itemsAfter.length > 0) {
                const beforeList: List = {
                    id: uuid(),
                    type: 'list',
                    ordered: sublist.ordered,
                    listStart: sublist.listStart,
                    tight: sublist.tight,
                    blocks: itemsBefore,
                    inlines: [],
                    text: '',
                    position: { start: 0, end: 0 },
                }
                const afterList: List = {
                    id: uuid(),
                    type: 'list',
                    ordered: sublist.ordered,
                    listStart: sublist.listStart,
                    tight: sublist.tight,
                    blocks: itemsAfter,
                    inlines: [],
                    text: '',
                    position: { start: 0, end: 0 },
                }

                ast.blocks.splice(listIndex, 1, beforeList)
                blocksToRemove.push(sublist)

                const insertIndex = listIndex + 1
                ast.blocks.splice(insertIndex, 0, ...blocksToInsert)

                ast.blocks.splice(insertIndex + blocksToInsert.length, 0, afterList)

                insertEffects.push({ at: 'current', target: sublist, current: beforeList })
                blocksToInsert.forEach((block, idx) => {
                    insertEffects.push({
                        at: 'next',
                        target: idx === 0 ? beforeList : blocksToInsert[idx - 1],
                        current: block,
                    })
                })
                insertEffects.push({
                    at: 'next',
                    target: blocksToInsert[blocksToInsert.length - 1],
                    current: afterList,
                })
            } else if (itemsBefore.length > 0) {
                const beforeList: List = {
                    id: uuid(),
                    type: 'list',
                    ordered: sublist.ordered,
                    listStart: sublist.listStart,
                    tight: sublist.tight,
                    blocks: itemsBefore,
                    inlines: [],
                    text: '',
                    position: { start: 0, end: 0 },
                }

                ast.blocks.splice(listIndex, 1, beforeList)
                blocksToRemove.push(sublist)

                const insertIndex = listIndex + 1
                ast.blocks.splice(insertIndex, 0, ...blocksToInsert)

                insertEffects.push({ at: 'current', target: sublist, current: beforeList })
                blocksToInsert.forEach((block, idx) => {
                    insertEffects.push({
                        at: 'next',
                        target: idx === 0 ? beforeList : blocksToInsert[idx - 1],
                        current: block,
                    })
                })
            } else if (itemsAfter.length > 0) {
                const afterList: List = {
                    id: uuid(),
                    type: 'list',
                    ordered: sublist.ordered,
                    listStart: sublist.listStart,
                    tight: sublist.tight,
                    blocks: itemsAfter,
                    inlines: [],
                    text: '',
                    position: { start: 0, end: 0 },
                }

                ast.blocks.splice(listIndex, 1, ...blocksToInsert, afterList)
                blocksToRemove.push(sublist)

                insertEffects.push({ at: 'current', target: sublist, current: blocksToInsert[0] })
                blocksToInsert.slice(1).forEach((block, idx) => {
                    insertEffects.push({
                        at: 'next',
                        target: blocksToInsert[idx],
                        current: block,
                    })
                })
                insertEffects.push({
                    at: 'next',
                    target: blocksToInsert[blocksToInsert.length - 1],
                    current: afterList,
                })
            } else {
                ast.blocks.splice(listIndex, 1, ...blocksToInsert)
                blocksToRemove.push(sublist)

                insertEffects.push({ at: 'current', target: sublist, current: blocksToInsert[0] })
                blocksToInsert.slice(1).forEach((block, idx) => {
                    insertEffects.push({
                        at: 'next',
                        target: blocksToInsert[idx],
                        current: block,
                    })
                })
            }

            const focusBlock = blocksToInsert[0]
            const focusInline = focusBlock?.inlines?.[0]
            if (!focusInline) return null

            return effect.compose(
                effect.update(insertEffects, blocksToRemove),
                effect.caret(focusBlock.id, focusInline.id, 0, 'start')
            )
        }

        const parentList = query.getListFromBlock(parentListItem)
        if (!parentList) return null

        const sublistIndex = sublist.blocks.indexOf(listItem)
        const parentIndex = parentList.blocks.indexOf(parentListItem)

        sublist.blocks.splice(sublistIndex, 1)

        if (sublist.blocks.length === 0) {
            const sublistIdx = parentListItem.blocks.indexOf(sublist)
            parentListItem.blocks.splice(sublistIdx, 1)
        }

        parentList.blocks.splice(parentIndex + 1, 0, listItem)

        return effect.compose(
            effect.update([{ at: 'current', target: parentListItem, current: parentListItem }, { at: 'next', target: parentListItem, current: listItem }]),
            effect.caret(listItem.id, listItem.blocks[0].inlines[0].id, 0, 'start')
        )
    }

    public isTableDivider(text: string): boolean {
        const trimmed = text.trim()
        return /^\|?\s*[-:]+(?:\s*\|\s*[-:]+)*\s*\|?$/.test(trimmed)
    }

    public isTableHeader(text: string): boolean {
        return /\|/.test(text.trim())
    }

    public getPreviousBlock(block: Block): Block | null {
        const { ast } = this.context

        const index = ast.blocks.findIndex(b => b.id === block.id)
        if (index <= 0) return null
        return ast.blocks[index - 1]
    }

    public mergeIntoTable(headerBlock: Block, dividerBlock: Block, dividerText: string): AstApplyEffect | null {
        const { ast, parser, effect } = this.context

        const combinedText = headerBlock.text + '\n' + dividerText
        const newBlocks = parser.reparseTextFragment(combinedText, headerBlock.position.start)
        
        if (newBlocks.length === 0 || newBlocks[0].type !== 'table') return null

        const table = newBlocks[0] as Table

        const firstRow = table.blocks[0] as TableRow
        const firstCell = firstRow?.blocks[0] as TableCell
        const firstParagraph = firstCell?.blocks[0]
        const inline = firstParagraph?.inlines[0]
        
        if (!inline) return null

        const headerIndex = ast.blocks.findIndex(b => b.id === headerBlock.id)
        ast.blocks.splice(headerIndex, 2, table)

        return effect.compose(
            effect.update([{ at: 'current', target: headerBlock, current: table }], [headerBlock, dividerBlock]),
            effect.caret(firstParagraph.id, inline.id, inline.position.end, 'start')
        )
    }

    public mergeTableCell(cellId: string): AstApplyEffect | null {
        const { ast, query, parser, effect } = this.context

        const cell = query.getBlockById(cellId) as TableCell | TableHeader
        if (!cell || (cell.type !== 'tableCell' && cell.type !== 'tableHeader')) return null

        const flat = query.flattenBlocks(ast.blocks)
        const rowEntry = flat.find(e => e.block.type === 'tableRow' && (e.block as TableRow).blocks.some(c => c.id === cellId))
        if (!rowEntry) return null

        const row = rowEntry.block as TableRow
        const cellIndex = row.blocks.findIndex(c => c.id === cellId)

        const tableEntry = flat.find(e => e.block.type === 'table' && (e.block as Table).blocks.some(r => r.id === row.id))
        if (!tableEntry) return null

        const table = tableEntry.block as Table
        const rowIndex = table.blocks.findIndex(r => r.id === row.id)

        let prevCell: TableCell | TableHeader | null = null
        let prevRow: TableRow | null = null

        if (cellIndex > 0) {
            prevCell = row.blocks[cellIndex - 1] as TableCell | TableHeader
            prevRow = row
        } else if (rowIndex > 0) {
            prevRow = table.blocks[rowIndex - 1] as TableRow
            prevCell = prevRow.blocks[prevRow.blocks.length - 1] as TableCell | TableHeader
        }

        if (!prevCell || !prevRow) {
            const isSingleCell = row.blocks.length === 1
            const isSingleRow = table.blocks.length === 1

            if (isSingleCell && isSingleRow) {
                const oldParagraph = cell.blocks[0]

                const paragraph: Block = {
                    id: uuid(),
                    type: 'paragraph',
                    text: oldParagraph.text,
                    position: { start: 0, end: oldParagraph.text.length },
                    inlines: [],
                }
                paragraph.inlines = parser.inline.parseInline(paragraph.text, paragraph.id, 'paragraph', 0)
                paragraph.inlines.forEach((i: Inline) => i.blockId = paragraph.id)

                const tableIndex = ast.blocks.findIndex(b => b.id === table.id)
                ast.blocks.splice(tableIndex, 1, paragraph)

                const focusInline = paragraph.inlines[0]
                if (!focusInline) return null

                return effect.compose(
                    effect.update([{ at: 'current', target: table, current: paragraph }], [table]),
                    effect.caret(paragraph.id, focusInline.id, 0, 'start')
                )
            }

            return null
        }

        const prevParagraph = prevCell.blocks[0]
        const currParagraph = cell.blocks[0]
        
        const mergedText = prevParagraph.text + currParagraph.text
        const newInlines = parser.inline.parseInline(mergedText, prevParagraph.id, prevParagraph.type, prevParagraph.position.start)
        
        const caretPosition = prevParagraph.text.length
        const { inline: caretInline, position } = query.getInlineAtPosition(newInlines, caretPosition) ?? { inline: null, position: 0 }
        if (!caretInline) return null

        prevParagraph.text = mergedText
        prevParagraph.inlines = newInlines
        newInlines.forEach((i: Inline) => i.blockId = prevParagraph.id)

        prevCell.text = mergedText
        const prevCellType = prevCell.type === 'tableHeader' ? 'tableHeader' : 'tableCell'
        prevCell.inlines = parser.inline.parseInline(mergedText, prevCell.id, prevCellType, prevCell.position.start)
        prevCell.inlines.forEach((i: Inline) => i.blockId = prevCell.id)

        row.blocks.splice(cellIndex, 1)

        const blocksToRemove: Block[] = [cell]

        if (row.blocks.length === 0) {
            table.blocks.splice(rowIndex, 1)
            blocksToRemove.push(row)
        }

        return effect.compose(
            effect.update([{ at: 'current', target: prevCell, current: prevCell }], blocksToRemove),
            effect.caret(prevParagraph.id, caretInline.id, position, 'start')
        )
    }

    public addTableColumn(cellId: string): AstApplyEffect | null {
        const { ast, query, parser, mutation, transform, effect } = this.context

        const cell = query.getBlockById(cellId) as TableCell | TableHeader
        if (!cell || (cell.type !== 'tableCell' && cell.type !== 'tableHeader')) return null

        const flat = query.flattenBlocks(ast.blocks)
        const rowEntry = flat.find(e => e.block.type === 'tableRow' && (e.block as TableRow).blocks.some(c => c.id === cellId))
        if (!rowEntry) return null

        const row = rowEntry.block as TableRow
        const cellIndex = row.blocks.findIndex(c => c.id === cellId)

        const tableEntry = flat.find(e => e.block.type === 'table' && (e.block as Table).blocks.some(r => r.id === row.id))
        const isHeaderRow = tableEntry && (tableEntry.block as Table).blocks[0]?.id === row.id

        const newParagraph: Block = {
            id: uuid(),
            type: 'paragraph',
            text: '',
            position: { start: 0, end: 0 },
            inlines: [],
        }
        newParagraph.inlines = parser.inline.parseInline('', newParagraph.id, 'paragraph', 0)
        newParagraph.inlines.forEach((i: Inline) => i.blockId = newParagraph.id)

        const newCell: TableCell | TableHeader = isHeaderRow ? {
            id: uuid(),
            type: 'tableHeader',
            text: '',
            position: { start: 0, end: 0 },
            blocks: [newParagraph],
            inlines: [],
        } : {
            id: uuid(),
            type: 'tableCell',
            text: '',
            position: { start: 0, end: 0 },
            blocks: [newParagraph],
            inlines: [],
        }
        const cellType = isHeaderRow ? 'tableHeader' : 'tableCell'
        newCell.inlines = parser.inline.parseInline('', newCell.id, cellType, 0)
        newCell.inlines.forEach((i: Inline) => i.blockId = newCell.id)

        row.blocks.splice(cellIndex + 1, 0, newCell)

        const focusInline = newParagraph.inlines[0]
        if (!focusInline) return null

        return effect.compose(
            effect.update([{ at: 'current', target: row, current: row }]),
            effect.caret(newParagraph.id, focusInline.id, 0, 'start')
        )
    }

    public addTableRow(cellId: string): AstApplyEffect | null {
        const { ast, query, parser, mutation, transform, effect } = this.context

        const cell = query.getBlockById(cellId) as TableCell | TableHeader
        if (!cell || (cell.type !== 'tableCell' && cell.type !== 'tableHeader')) return null

        const flat = query.flattenBlocks(ast.blocks)
        const rowEntry = flat.find(e => e.block.type === 'tableRow' && (e.block as TableRow).blocks.some(c => c.id === cellId))
        if (!rowEntry) return null

        const row = rowEntry.block as TableRow

        const tableEntry = flat.find(e => e.block.type === 'table' && (e.block as Table).blocks.some(r => r.id === row.id))
        if (!tableEntry) return null

        const table = tableEntry.block as Table
        const rowIndex = table.blocks.findIndex(r => r.id === row.id)

        const newParagraph: Block = {
            id: uuid(),
            type: 'paragraph',
            text: '',
            position: { start: 0, end: 0 },
            inlines: [],
        }
        newParagraph.inlines = parser.inline.parseInline('', newParagraph.id, 'paragraph', 0)
        newParagraph.inlines.forEach((i: Inline) => i.blockId = newParagraph.id)

        const newCell: TableCell = {
            id: uuid(),
            type: 'tableCell',
            text: '',
            position: { start: 0, end: 0 },
            blocks: [newParagraph],
            inlines: [],
        }
        newCell.inlines = parser.inline.parseInline('', newCell.id, 'tableCell', 0)
        newCell.inlines.forEach((i: Inline) => i.blockId = newCell.id)

        const newRow: TableRow = {
            id: uuid(),
            type: 'tableRow',
            text: '',
            position: { start: 0, end: 0 },
            blocks: [newCell],
            inlines: [],
        }

        table.blocks.splice(rowIndex + 1, 0, newRow)

        const focusInline = newParagraph.inlines[0]
        if (!focusInline) return null

        return effect.compose(
            effect.update([{ at: 'next', target: row, current: newRow }]),
            effect.caret(newParagraph.id, focusInline.id, 0, 'start')
        )
    }

    public addTableRowAbove(cellId: string): AstApplyEffect | null {
        const { ast, query, parser, mutation, transform, effect } = this.context

        const cell = query.getBlockById(cellId) as TableCell | TableHeader
        if (!cell || (cell.type !== 'tableCell' && cell.type !== 'tableHeader')) return null

        const flat = query.flattenBlocks(ast.blocks)
        const rowEntry = flat.find(e => e.block.type === 'tableRow' && (e.block as TableRow).blocks.some(c => c.id === cellId))
        if (!rowEntry) return null

        const row = rowEntry.block as TableRow

        const tableEntry = flat.find(e => e.block.type === 'table' && (e.block as Table).blocks.some(r => r.id === row.id))
        if (!tableEntry) return null

        const table = tableEntry.block as Table
        const rowIndex = table.blocks.findIndex(r => r.id === row.id)

        const newParagraph: Block = {
            id: uuid(),
            type: 'paragraph',
            text: '',
            position: { start: 0, end: 0 },
            inlines: [],
        }
        newParagraph.inlines = parser.inline.parseInline('', newParagraph.id, 'paragraph', 0)
        newParagraph.inlines.forEach((i: Inline) => i.blockId = newParagraph.id)

        const newCell: TableCell = {
            id: uuid(),
            type: 'tableCell',
            text: '',
            position: { start: 0, end: 0 },
            blocks: [newParagraph],
            inlines: [],
        }
        newCell.inlines = parser.inline.parseInline('', newCell.id, 'tableCell', 0)
        newCell.inlines.forEach((i: Inline) => i.blockId = newCell.id)

        const newRow: TableRow = {
            id: uuid(),
            type: 'tableRow',
            text: '',
            position: { start: 0, end: 0 },
            blocks: [newCell],
            inlines: [],
        }

        table.blocks.splice(rowIndex, 0, newRow)

        const focusInline = newParagraph.inlines[0]
        if (!focusInline) return null

        return effect.compose(
            effect.update([{ at: 'previous', target: row, current: newRow }]),
            effect.caret(newParagraph.id, focusInline.id, 0, 'start')
        )
    }

    public splitTableCell(cellId: string, blockId: string, inlineId: string, caretPosition: number): AstApplyEffect | null {
        const { ast, query, parser, mutation, transform, effect } = this.context

        const cell = query.getBlockById(cellId) as TableCell | TableHeader
        if (!cell || (cell.type !== 'tableCell' && cell.type !== 'tableHeader')) return null

        const block = cell.blocks.find(b => b.id === blockId)
        if (!block) return null

        const blockIndex = cell.blocks.findIndex(b => b.id === blockId)

        const inline = block.inlines.find(i => i.id === inlineId)
        if (!inline) return null

        const inlineIndex = block.inlines.findIndex(i => i.id === inlineId)

        let textBeforeCaret = ''
        for (let i = 0; i < inlineIndex; i++) {
            textBeforeCaret += block.inlines[i].text.symbolic
        }
        textBeforeCaret += inline.text.symbolic.slice(0, caretPosition)

        const textAfterCaret = block.inlines
            .slice(inlineIndex)
            .map((i, idx) => idx === 0 ? i.text.symbolic.slice(caretPosition) : i.text.symbolic)
            .join('')

        block.text = textBeforeCaret
        block.inlines = parser.inline.parseInline(textBeforeCaret, block.id, block.type, block.position.start)
        block.inlines.forEach((i: Inline) => i.blockId = block.id)

        const newBlock: Block = {
            id: uuid(),
            type: 'paragraph',
            text: textAfterCaret,
            position: { start: 0, end: textAfterCaret.length },
            inlines: [],
        }
        newBlock.inlines = parser.inline.parseInline(textAfterCaret, newBlock.id, 'paragraph', 0)
        newBlock.inlines.forEach((i: Inline) => i.blockId = newBlock.id)

        cell.blocks.splice(blockIndex + 1, 0, newBlock)

        const focusInline = newBlock.inlines[0]
        if (!focusInline) return null

        return effect.compose(
            effect.update([{ at: 'current', target: cell, current: cell }]),
            effect.caret(newBlock.id, focusInline.id, 0, 'start')
        )
    }

    public splitTableCellAtCaret(cellId: string, blockId: string, inlineId: string, caretPosition: number): AstApplyEffect | null {
        const { ast, query, parser, mutation, transform, effect } = this.context

        const cell = query.getBlockById(cellId) as TableCell | TableHeader
        if (!cell || (cell.type !== 'tableCell' && cell.type !== 'tableHeader')) return null

        const flat = query.flattenBlocks(ast.blocks)
        const rowEntry = flat.find(e => e.block.type === 'tableRow' && (e.block as TableRow).blocks.some(c => c.id === cellId))
        if (!rowEntry) return null

        const row = rowEntry.block as TableRow
        const cellIndex = row.blocks.findIndex(c => c.id === cellId)

        const block = cell.blocks.find(b => b.id === blockId)
        if (!block) return null

        const inline = block.inlines.find(i => i.id === inlineId)
        if (!inline) return null

        const inlineIndex = block.inlines.findIndex(i => i.id === inlineId)

        let textBeforeCaret = ''
        for (let i = 0; i < inlineIndex; i++) {
            textBeforeCaret += block.inlines[i].text.symbolic
        }
        textBeforeCaret += inline.text.symbolic.slice(0, caretPosition)

        const textAfterCaret = block.inlines
            .slice(inlineIndex)
            .map((i, idx) => idx === 0 ? i.text.symbolic.slice(caretPosition) : i.text.symbolic)
            .join('')

        block.text = textBeforeCaret
        block.inlines = parser.inline.parseInline(textBeforeCaret, block.id, block.type, block.position.start)
        block.inlines.forEach((i: Inline) => i.blockId = block.id)

        cell.text = textBeforeCaret
        const cellType = cell.type === 'tableHeader' ? 'tableHeader' : 'tableCell'
        cell.inlines = parser.inline.parseInline(textBeforeCaret, cell.id, cellType, cell.position.start)
        cell.inlines.forEach((i: Inline) => i.blockId = cell.id)

        const newParagraph: Block = {
            id: uuid(),
            type: 'paragraph',
            text: textAfterCaret,
            position: { start: 0, end: textAfterCaret.length },
            inlines: [],
        }
        newParagraph.inlines = parser.inline.parseInline(textAfterCaret, newParagraph.id, 'paragraph', 0)
        newParagraph.inlines.forEach((i: Inline) => i.blockId = newParagraph.id)

        const newCell: TableCell | TableHeader = cell.type === 'tableHeader' ? {
            id: uuid(),
            type: 'tableHeader',
            text: textAfterCaret,
            position: { start: 0, end: textAfterCaret.length },
            blocks: [newParagraph],
            inlines: [],
        } : {
            id: uuid(),
            type: 'tableCell',
            text: textAfterCaret,
            position: { start: 0, end: textAfterCaret.length },
            blocks: [newParagraph],
            inlines: [],
        }
        newCell.inlines = parser.inline.parseInline(textAfterCaret, newCell.id, cellType, 0)
        newCell.inlines.forEach((i: Inline) => i.blockId = newCell.id)

        row.blocks.splice(cellIndex + 1, 0, newCell)

        const focusInline = newParagraph.inlines[0]
        if (!focusInline) return null

        return effect.compose(
            effect.update([{ at: 'current', target: cell, current: cell }, { at: 'next', target: cell, current: newCell }]),
            effect.caret(newParagraph.id, focusInline.id, 0, 'start')
        )
    }

    public mergeBlocksInCell(cellId: string, blockId: string): AstApplyEffect | null {
        const { query, parser, effect } = this.context

        const cell = query.getBlockById(cellId) as TableCell | TableHeader
        if (!cell || (cell.type !== 'tableCell' && cell.type !== 'tableHeader')) return null

        const blockIndex = cell.blocks.findIndex(b => b.id === blockId)
        if (blockIndex <= 0) return null

        const currentBlock = cell.blocks[blockIndex]
        const previousBlock = cell.blocks[blockIndex - 1]

        const mergedText = previousBlock.text + currentBlock.text
        const caretPosition = previousBlock.text.length

        previousBlock.text = mergedText
        previousBlock.inlines = parser.inline.parseInline(mergedText, previousBlock.id, previousBlock.type, previousBlock.position.start)
        previousBlock.inlines.forEach((i: Inline) => i.blockId = previousBlock.id)

        cell.blocks.splice(blockIndex, 1)

        const { inline: caretInline, position } = query.getInlineAtPosition(previousBlock.inlines, caretPosition) ?? { inline: null, position: 0 }
        if (!caretInline) return null

        return effect.compose(
            effect.update([{ at: 'current', target: cell, current: cell }]),
            effect.caret(previousBlock.id, caretInline.id, position, 'start')
        )
    }

    public mergeInlineInCell(cellId: string, leftInlineId: string, rightInlineId: string): AstApplyEffect | null {
        const { query, effect } = this.context

        const cell = query.getBlockById(cellId) as TableCell | TableHeader
        if (!cell || (cell.type !== 'tableCell' && cell.type !== 'tableHeader')) return null

        let targetBlock: Block | null = null
        for (const block of cell.blocks) {
            const hasLeft = block.inlines.some(i => i.id === leftInlineId)
            const hasRight = block.inlines.some(i => i.id === rightInlineId)
            if (hasLeft && hasRight) {
                targetBlock = block
                break
            }
        }
        if (!targetBlock) return null

        const leftInline = targetBlock.inlines.find(i => i.id === leftInlineId)
        const rightInline = targetBlock.inlines.find(i => i.id === rightInlineId)
        if (!leftInline || !rightInline) return null

        const leftIndex = targetBlock.inlines.findIndex(i => i.id === leftInlineId)
        const rightIndex = targetBlock.inlines.findIndex(i => i.id === rightInlineId)

        const caretPosition = leftInline.text.symbolic.length
        leftInline.text.symbolic += rightInline.text.symbolic
        leftInline.text.semantic += rightInline.text.semantic
        leftInline.position.end = leftInline.position.start + leftInline.text.symbolic.length

        targetBlock.inlines.splice(rightIndex, 1)

        targetBlock.text = targetBlock.inlines.map(i => i.text.symbolic).join('')

        return effect.compose(
            effect.update([{ at: 'current', target: cell, current: cell }]),
            effect.caret(targetBlock.id, leftInline.id, caretPosition, 'start')
        )
    }

    public insertParagraphAboveTable(tableId: string): AstApplyEffect | null {
        const { ast, query, parser, effect } = this.context

        const table = query.getBlockById(tableId) as Table
        if (!table || table.type !== 'table') return null

        const tableIndex = ast.blocks.findIndex(b => b.id === tableId)
        if (tableIndex === -1) return null

        const paragraph: Block = {
            id: uuid(),
            type: 'paragraph',
            text: '',
            position: { start: 0, end: 0 },
            inlines: [],
        }
        paragraph.inlines = parser.inline.parseInline('', paragraph.id, 'paragraph', 0)
        paragraph.inlines.forEach((i: Inline) => i.blockId = paragraph.id)

        ast.blocks.splice(tableIndex, 0, paragraph)

        const focusInline = paragraph.inlines[0]
        if (!focusInline) return null

        return effect.compose(
            effect.update([{ at: 'previous', target: table, current: paragraph }]),
            effect.caret(paragraph.id, focusInline.id, 0, 'start')
        )
    }

    public insertParagraphBelowTable(tableId: string): AstApplyEffect | null {
        const { ast, query, parser, effect } = this.context

        const table = query.getBlockById(tableId) as Table
        if (!table || table.type !== 'table') return null

        const tableIndex = ast.blocks.findIndex(b => b.id === tableId)
        if (tableIndex === -1) return null

        const paragraph: Block = {
            id: uuid(),
            type: 'paragraph',
            text: '',
            position: { start: 0, end: 0 },
            inlines: [],
        }
        paragraph.inlines = parser.inline.parseInline('', paragraph.id, 'paragraph', 0)
        paragraph.inlines.forEach((i: Inline) => i.blockId = paragraph.id)

        ast.blocks.splice(tableIndex + 1, 0, paragraph)

        const focusInline = paragraph.inlines[0]
        if (!focusInline) return null

        return effect.compose(
            effect.update([{ at: 'next', target: table, current: paragraph }]),
            effect.caret(paragraph.id, focusInline.id, 0, 'start')
        )
    }
}

export default Edit
