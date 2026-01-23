import { detectBlockType } from '../parser/block/blockDetect'
import { uuid } from '../../utils/utils'
import type { AstContext } from './astContext'
import type { AstApplyEffect, Block, Inline, List, ListItem, Table, TableRow, TableHeader, TableCell, TaskListItem, BlockQuote, Paragraph, CodeBlock } from '../../types'

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
    
        const newText =
            block.inlines.slice(0, inlineIndex).map(i => i.text.symbolic).join('') +
            text +
            block.inlines.slice(inlineIndex + 1).map(i => i.text.symbolic).join('')
    
        const detectedBlock = detectBlockType(newText)
    
        const blockTypeChanged =
            detectedBlock.type !== block.type ||
            (detectedBlock.type === 'heading' && block.type === 'heading' && detectedBlock.level !== block.level)
    
        const ignoreTypes = ['blankLine', 'table']
    
        const inListItem = (() => {
            const flat = query.flattenBlocks(this.context.ast.blocks)
            const entry = flat.find(b => b.block.id === block.id)
            if (!entry?.parent) return false
            return entry.parent.type === 'listItem' || entry.parent.type === 'taskListItem'
        })()
    
        const taskPrefix = /^\[([ xX])\](?:\s+|$)/.test(newText)
    
        if (
            (blockTypeChanged && !ignoreTypes.includes(detectedBlock.type)) ||
            (block.type === 'paragraph' && inListItem && taskPrefix)
        ) {
            if (detectedBlock.type === 'listItem' || detectedBlock.type === 'taskListItem' || detectedBlock.type === 'blockQuote') caretPosition = 0
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

        const result = mutation.splitBlockPure(block, inlineId, caretPosition, {
            rightType: block.type === 'blockQuote' ? 'blockQuote' : undefined,
        })
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

    private syncFencedCodeBlockFromMarker(block: CodeBlock) {
        if (!block.isFenced) return

        const marker = block.inlines?.find(i => i.type === 'marker') ?? null
        if (!marker) return

        let symbolic = marker.text.symbolic ?? ''
        if (symbolic.endsWith('\n')) symbolic = symbolic.slice(0, -1)

        const m = symbolic.match(/^(\s{0,3})(```+|~~~+)(.*)$/)
        if (!m) return

        const indent = m[1].length
        const fence = m[2]
        const rawInfo = m[3] ?? ''
        const info = rawInfo.trim()

        block.openIndent = indent
        block.fenceChar = fence.charAt(0) as any
        block.fenceLength = fence.length

        if (info.length > 0) {
            block.infoString = info
            block.language = info
        } else {
            block.infoString = undefined
            block.language = undefined
        }

        if (marker.text.symbolic && !marker.text.symbolic.endsWith('\n')) {
            marker.text.symbolic = marker.text.symbolic + '\n'
        }
    }

    private normalizeFencedCodeBlockPayloadNewlines(cb: CodeBlock) {
        if (!cb.isFenced) return

        const t = cb.inlines?.find(i => i.type === 'text') ?? null
        if (!t) return

        let sym = t.text.symbolic === '\u200B' ? '' : (t.text.symbolic ?? '')
        let sem = t.text.semantic ?? ''

        if (sym.startsWith('\n')) sym = sym.slice(1)
        if (sem.startsWith('\n')) sem = sem.slice(1)
        if (sym.endsWith('\n')) sym = sym.slice(0, -1)
        if (sem.endsWith('\n')) sem = sem.slice(0, -1)
      

        if (sym.length === 0) {
            t.text.symbolic = '\u200B'
            t.text.semantic = ''
        } else {
            t.text.symbolic = sym
            t.text.semantic = sem
        }

        const marker = cb.inlines?.find(i => i.type === 'marker') ?? null
        if (marker) {
            t.position.start = marker.position.end
            t.position.end = t.position.start + t.text.symbolic.length
        }

        cb.text = t.text.semantic.replace(/^\u200B$/, '')
    }      

    public mergeInline(inlineAId: string, inlineBId: string): AstApplyEffect | null {
        const { ast, query, mutation, transform, effect } = this.context

        const flattened = query.flattenInlines(ast.blocks)
        const iA = flattened.findIndex(i => i.inline.id === inlineAId)
        const iB = flattened.findIndex(i => i.inline.id === inlineBId)
        if (iA === -1 || iB === -1) return null

        const [leftInline, rightInline] = iA < iB
            ? [flattened[iA].inline, flattened[iB].inline]
            : [flattened[iB].inline, flattened[iA].inline]

        const result = mutation.mergeInlinePure(leftInline, rightInline)

        if (!result) return null

        const { leftBlock, mergedInline, removedBlock } = result

        const mergeAdjacentIn = (arr: Block[]) => {
            let i = 0
            while (i < arr.length - 1) {
                const a = arr[i]
                const b = arr[i + 1]

                if (a.type === 'blockQuote' && b.type === 'blockQuote') {
                    ;(a as BlockQuote).blocks.push(...(b as BlockQuote).blocks)
                    a.position.end = b.position.end
                    arr.splice(i + 1, 1)
                    continue
                }

                i++
            }
        }

        let removedBlocks: Block[] = []
        if (removedBlock) {
            if (removedBlock.type === 'blockQuote') {
                const quote = removedBlock as BlockQuote
                const lifted = quote.blocks ?? []

                const parent = query.getParentBlock(quote) as Block | null

                if (parent && parent.type === 'blockQuote') {
                    const p = parent as BlockQuote
                    const idx = p.blocks.findIndex(b => b.id === quote.id)
                    if (idx === -1) return null

                    p.blocks.splice(idx, 1, ...lifted)

                    mergeAdjacentIn(p.blocks)

                    const caretBlock = leftBlock
                    const caretInline = mergedInline
                    const caretPos = 0

                    return effect.compose(
                        effect.update([{ at: 'current', target: p, current: p }], [quote]),
                        effect.caret(caretBlock.id, caretInline.id, caretPos, 'start')
                    )
                }

                const idx = ast.blocks.findIndex(b => b.id === quote.id)
                if (idx === -1) return null

                ast.blocks.splice(idx, 1, ...lifted)

                mergeAdjacentIn(ast.blocks)

                const caretBlock = leftBlock
                const caretInline = mergedInline
                const caretPos = 0

                return effect.compose(
                    effect.update([{ at: 'current', target: caretBlock, current: caretBlock }], [quote]),
                    effect.caret(caretBlock.id, caretInline.id, caretPos, 'start')
                )
            }

            removedBlocks = mutation.removeBlockCascade(removedBlock)
        }

        if (leftBlock.type === 'codeBlock') {
            const cb = leftBlock as CodeBlock

            if (cb.isFenced) {
                this.syncFencedCodeBlockFromMarker(cb)
                this.normalizeFencedCodeBlockPayloadNewlines(cb)

                const t = cb.inlines?.find(i => i.type === 'text') ?? null
                cb.text = t ? (t.text.semantic ?? '').replace(/^\u200B$/, '') : ''
            }
        }

        const caretPositionInMergedInline = removedBlock
            ? leftInline.text.symbolic.length
            : leftInline.text.symbolic.length - 1

        const newText = leftBlock.inlines.map(i => i.text.symbolic).join('')
        const detectedBlock = detectBlockType(newText)

        const blockTypeChanged =
            detectedBlock.type !== leftBlock.type ||
            (detectedBlock.type === 'heading' && leftBlock.type === 'heading' && detectedBlock.level !== leftBlock.level)

        const ignoreTypes = ['blankLine', 'table']
        if (blockTypeChanged && !ignoreTypes.includes(detectedBlock.type)) {
            return transform.transformBlock(newText, leftBlock, detectedBlock, caretPositionInMergedInline, removedBlocks)
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

    public splitTaskListItem(taskListItemId: string, blockId: string, inlineId: string, caretPosition: number): AstApplyEffect | null {
        const { query, parser, mutation, effect } = this.context

        const taskListItem = query.getBlockById(taskListItemId) as TaskListItem
        if (!taskListItem) return null

        const list = query.getParentBlock(taskListItem) as List
        if (!list) return null

        const block = taskListItem.blocks.find(b => b.id === blockId)
        if (!block) return null

        const result = mutation.splitBlockPure(block, inlineId, caretPosition)
        if (!result) return null

        const { left, right } = result

        const newLeft = parser.reparseTextFragment(left.text, left.position.start)
        const newRight = parser.reparseTextFragment(right.text, right.position.start)

        taskListItem.blocks = newLeft

        const index = list.blocks.findIndex(b => b.id === taskListItem.id)
        taskListItem.text = query.getTaskListItemText(taskListItem)

        const newListItem: TaskListItem = {
            id: uuid(),
            type: 'taskListItem',
            checked: false,
            blocks: [],
            inlines: [],
            text: '',
            position: {
                start: taskListItem.position.end,
                end: taskListItem.position.end,
            },
        }

        const marker = query.getTaskListItemMarker(newListItem)

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
                { at: 'current', target: taskListItem, current: taskListItem },
                { at: 'next', target: taskListItem, current: newListItem },
            ]),
            effect.caret(newListItem.blocks[0].id, newListItem.blocks[0].inlines[0].id, 0, 'start')
        )
    }

    public splitBlockQuote(
        blockQuoteId: string,
        blockId: string,
        inlineId: string,
        caretPosition: number
    ): AstApplyEffect | null {
        const { ast, query, parser, mutation, effect } = this.context
    
        const rootQuote = query.getBlockById(blockQuoteId) as BlockQuote | null
        if (!rootQuote || rootQuote.type !== 'blockQuote') return null
    
        let block = query.getBlockById(blockId)
        if (!block) return null

        {
            let p: Block | null = block
            const chain: string[] = []
            while (p) {
                chain.push(`${p.type}:${p.id}`)
                p = query.getParentBlock(p) as Block | null
            }
        }
    
        if (block.type === 'blockQuote') {
            let q = block as BlockQuote
    
            while (true) {
                const last = q.blocks?.[q.blocks.length - 1]
                if (last && last.type === 'blockQuote') {
                    q = last as BlockQuote
                    continue
                }
                break
            }
    
            let p = q.blocks?.find(b => b.type === 'paragraph') as Block | undefined
            if (!p) {
                const created = parser.reparseTextFragment('\u200B', q.position.start)
                const para = created.find(b => b.type === 'paragraph') as Block | undefined
                if (!para) return null
    
                q.blocks = q.blocks ?? []
                q.blocks.push(para)
                parser.inline.applyRecursive(q)
    
                const i0 = (para as any).inlines?.[0]
                if (!i0) return null
    
                return effect.compose(
                    effect.update([
                        { at: 'current', target: q, current: q },
                        { at: 'current', target: rootQuote, current: rootQuote },
                    ] as any[]),
                    effect.caret(para.id, i0.id, 0, 'start')
                )
            }
    
            block = p
            inlineId = (p as any).inlines?.[0]?.id ?? inlineId
            caretPosition = 0
        }
    
        let container = query.getParentBlock(block) as Block | null
        if (!container) return null
    
        while (container && container.type !== 'blockQuote') {
            container = query.getParentBlock(container) as Block | null
        }
        if (!container || container.type !== 'blockQuote') return null
    
        if (container.id !== rootQuote.id) {
            let p = query.getParentBlock(container) as Block | null
            let insideRoot = false
            while (p) {
                if (p.id === rootQuote.id) { insideRoot = true; break }
                p = query.getParentBlock(p) as Block | null
            }
            if (!insideRoot) return null
        }
    
        const blockQuote = container as BlockQuote
    
        const split = mutation.splitBlockPure(block, inlineId, caretPosition)
        if (!split) return null
    
        const leftChild = split.left
        const rightChild = split.right
    
        const i = blockQuote.blocks.findIndex(b => b.id === block.id)
        if (i === -1) return null
    
        blockQuote.blocks.splice(i, 1, leftChild, rightChild)
    
        parser.inline.applyRecursive(leftChild)
        parser.inline.applyRecursive(rightChild)
    
        const rightParagraph = rightChild
        const rightInline = rightParagraph.inlines?.[0]
        if (!rightInline) return null
    
        const updates = [
            { at: 'current', target: block, current: leftChild },
            { at: 'next', target: leftChild, current: rightChild },
            { at: 'current', target: blockQuote, current: blockQuote },
        ] as any[]
    
        if (blockQuote.id !== rootQuote.id) {
            updates.push({ at: 'current', target: rootQuote, current: rootQuote })
        }
    
        return effect.compose(
            effect.update(updates),
            effect.caret(rightParagraph.id, rightInline.id, 0, 'start')
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

    public indentTaskListItem(taskListItemId: string): AstApplyEffect | null {
        const { query, effect } = this.context

        const taskListItem = query.getBlockById(taskListItemId) as TaskListItem | null
        if (!taskListItem) return null

        const list = query.getListFromBlock(taskListItem)
        if (!list) return null

        const index = list.blocks.findIndex(b => b.id === taskListItem.id)
        if (index <= 0) return null

        const prev = list.blocks[index - 1] as TaskListItem
    
        let sublist = prev.blocks.find(b => b.type === 'list') as List | undefined
        let createdSublist = false
        if (!sublist) {
            sublist = {
                id: uuid(),
                type: 'list',
                ordered: false,
                listStart: 1,
                tight: list.tight,
                blocks: [],
                inlines: [],
                text: '',
                position: { start: 0, end: 0 },
            }
            prev.blocks.push(sublist)
            createdSublist = true
        }

        list.blocks.splice(index, 1)
        sublist.blocks.push(taskListItem)

        const firstChild = taskListItem.blocks?.[0]
        const firstInline = firstChild && 'inlines' in firstChild ? firstChild.inlines?.[0] : null
        if (!firstInline) {
            return null
        }

        const updatedTargets = [
            { at: 'current' as const, target: list, current: list },
            { at: 'current' as const, target: prev, current: prev },
        ]

        if (createdSublist) {
            updatedTargets.push({ at: 'current', target: sublist, current: sublist })
        }

        return effect.compose(
            effect.update(updatedTargets, []),
            effect.caret(taskListItem.id, firstInline.id, 0, 'start')
        )
    }

    public indentBlockQuote(blockQuoteId: string, blockId: string, inlineId: string): AstApplyEffect | null {
        const { query, effect } = this.context

        const blockQuote = query.getBlockById(blockQuoteId) as BlockQuote | null
        if (!blockQuote || blockQuote.type !== 'blockQuote') return null
    
        blockQuote.blocks = blockQuote.blocks ?? []
    
        const index = blockQuote.blocks.findIndex(b => b.id === blockId)
        if (index < 0) return null
    
        const block = blockQuote.blocks[index]
        const oldId = block.id
    
        const nested: BlockQuote = {
            id: oldId,
            type: 'blockQuote',
            text: '> ',
            position: { start: 0, end: 0 },
            inlines: [{
                id: uuid(),
                type: 'marker',
                blockId: oldId,
                text: { symbolic: '> ', semantic: '' },
                position: { start: 0, end: 2 },
            }] as any,
            blocks: [],
        }

        block.id = uuid()
        ;(block as any).inlines.forEach((i: Inline) => i.blockId = block.id)

        nested.blocks.push(block)
        blockQuote.blocks.splice(index, 1, nested)

        return effect.compose(
            effect.update([{ at: 'current', target: blockQuote, current: blockQuote }]),
            effect.caret(block.id, inlineId, 0, 'start')
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
                effect.update(insertEffects),
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

    public outdentTaskListItem(taskListItemId: string): AstApplyEffect | null {
        const { ast, query, parser, effect } = this.context

        const taskListItem = query.getBlockById(taskListItemId) as TaskListItem
        if (!taskListItem) return null

        const sublist = query.getListFromBlock(taskListItem)
        if (!sublist) return null

        const parentTaskListItem = query.getParentBlock(sublist) as TaskListItem | null
        
        if (!parentTaskListItem || parentTaskListItem.type !== 'taskListItem') {
            const flat = query.flattenBlocks(ast.blocks)
            const listEntry = flat.find(b => b.block.id === sublist.id)
            if (!listEntry) return null

            const listIndex = ast.blocks.findIndex(b => b.id === sublist.id)
            const itemIndex = sublist.blocks.indexOf(taskListItem)

            const itemsBefore = sublist.blocks.slice(0, itemIndex)
            const itemsAfter = sublist.blocks.slice(itemIndex + 1)

            const contentBlocks = taskListItem.blocks.filter(b => b.type !== 'list')
            const nestedList = taskListItem.blocks.find(b => b.type === 'list') as List | undefined

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
                    ordered: false,
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
                    ordered: false,
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
                    ordered: false,
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
                effect.update(insertEffects),
                effect.caret(focusBlock.id, focusInline.id, 0, 'start')
            )
        }

        const parentList = query.getListFromBlock(parentTaskListItem)
        if (!parentList) return null

        const sublistIndex = sublist.blocks.indexOf(taskListItem)
        const parentIndex = parentList.blocks.indexOf(parentTaskListItem)

        sublist.blocks.splice(sublistIndex, 1)

        if (sublist.blocks.length === 0) {
            const sublistIdx = parentTaskListItem.blocks.indexOf(sublist)
            parentTaskListItem.blocks.splice(sublistIdx, 1)
        }

        parentList.blocks.splice(parentIndex + 1, 0, taskListItem)

        return effect.compose(
            effect.update([{ at: 'current', target: parentTaskListItem, current: parentTaskListItem }, { at: 'next', target: parentTaskListItem, current: taskListItem }]),
            effect.caret(taskListItem.id, taskListItem.blocks[0].inlines[0].id, 0, 'start')
        )
    }

    public outdentBlockQuote(blockQuoteId: string, blockId: string, inlineId: string): AstApplyEffect | null {
        const { ast, query, effect } = this.context
    
        const blockQuote = query.getBlockById(blockQuoteId) as BlockQuote | null
        if (!blockQuote || blockQuote.type !== 'blockQuote') return null
    
        blockQuote.blocks = blockQuote.blocks ?? []
    
        const childIndex = blockQuote.blocks.findIndex(b => b.id === blockId)
        if (childIndex === -1) return null
    
        const before = blockQuote.blocks.slice(0, childIndex)
        const liftedBlock = blockQuote.blocks[childIndex]
        const after = blockQuote.blocks.slice(childIndex + 1)
    
        const makeQuote = (blocks: Block[]): BlockQuote => {
            const q: BlockQuote = {
                ...blockQuote,
                id: uuid(),
                blocks: blocks,
            }
            ;(q.inlines as any)?.forEach((i: Inline) => i.blockId = q.id)
            return q
        }
    
        const parts: Block[] = []
    
        if (before.length > 0) {
            blockQuote.blocks = before
            parts.push(blockQuote)
        }
    
        parts.push(liftedBlock)
    
        if (after.length > 0) {
            const afterQuote = makeQuote(after)
            parts.push(afterQuote)
        }
    
        const parent = query.getParentBlock(blockQuote) as Block | null
    
        let container: Block[]
        let index: number
    
        if (parent && parent.type === 'blockQuote') {
            const p = parent as BlockQuote
            p.blocks = p.blocks ?? []
            container = p.blocks
            index = container.findIndex(b => b.id === blockQuote.id)
            if (index === -1) return null
    
            container.splice(index, 1, ...parts)
    
            const inserts: Array<{ at: 'current' | 'next'; target: Block; current: Block }> = []
    
            if (before.length > 0) {
                inserts.push({ at: 'current', target: blockQuote, current: blockQuote })
                inserts.push({ at: 'next', target: blockQuote, current: liftedBlock })
                if (after.length > 0) inserts.push({ at: 'next', target: liftedBlock, current: parts[2] })
            } else {
                inserts.push({ at: 'current', target: blockQuote, current: liftedBlock })
                if (after.length > 0) inserts.push({ at: 'next', target: liftedBlock, current: parts[1] })
            }

            return effect.compose(
                effect.update(inserts, [liftedBlock]),
                effect.caret(liftedBlock.id, inlineId, 0, 'start')
            )
        }
    
        container = ast.blocks
        index = container.findIndex(b => b.id === blockQuote.id)
        if (index === -1) return null
    
        container.splice(index, 1, ...parts)
    
        const inserts: Array<{ at: 'current' | 'next'; target: Block; current: Block }> = []
    
        if (before.length > 0) {
            inserts.push({ at: 'current', target: blockQuote, current: blockQuote })
            inserts.push({ at: 'next', target: blockQuote, current: liftedBlock })
            if (after.length > 0) inserts.push({ at: 'next', target: liftedBlock, current: parts[2] })
        } else {
            inserts.push({ at: 'current', target: blockQuote, current: liftedBlock })
            if (after.length > 0) inserts.push({ at: 'next', target: liftedBlock, current: parts[1] })
        }

        return effect.compose(
            effect.update(inserts, [liftedBlock]),
            effect.caret(liftedBlock.id, inlineId, 0, 'start')
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

    public pasteMultiBlock(
        blockId: string,
        inlineId: string,
        pastedText: string,
        startPosition: number,
        endPosition?: number
    ): AstApplyEffect | null {
        const { ast, query, parser, effect } = this.context

        const block = query.getBlockById(blockId)
        if (!block) return null

        const inline = query.getInlineById(inlineId)
        if (!inline) return null

        const inlineIndex = block.inlines.findIndex(i => i.id === inlineId)
        const textBefore = block.inlines
            .slice(0, inlineIndex)
            .map(i => i.text.symbolic)
            .join('') + inline.text.symbolic.slice(0, startPosition)
        
        let textAfter = ''
        if (endPosition !== undefined) {
            const endInline = query.getInlineById(inlineId)
            if (endInline && endInline.id === inline.id) {
                textAfter = inline.text.symbolic.slice(endPosition) +
                    block.inlines
                        .slice(inlineIndex + 1)
                        .map(i => i.text.symbolic)
                        .join('')
            } else if (endInline) {
                const endInlineIndex = block.inlines.findIndex(i => i.id === endInline.id)
                textAfter = endInline.text.symbolic.slice(endPosition) +
                    block.inlines
                        .slice(endInlineIndex + 1)
                        .map(i => i.text.symbolic)
                        .join('')
            }
        } else {
            textAfter = inline.text.symbolic.slice(startPosition) +
                block.inlines
                    .slice(inlineIndex + 1)
                    .map(i => i.text.symbolic)
                    .join('')
        }

        const text = textBefore + pastedText + textAfter

        const newBlocks = parser.reparseTextFragment(text, block.position.start)
        if (newBlocks.length === 0) return null

        const flat = query.flattenBlocks(ast.blocks)
        const entry = flat.find(b => b.block.id === block.id)
        if (!entry) return null

        ast.blocks.splice(entry.index, 1, ...newBlocks)

        const lastBlock = newBlocks[newBlocks.length - 1]
        const lastInline = query.getFirstInline([lastBlock])
        if (!lastInline) return null

        const updateEffects = newBlocks.map((b, idx) => ({
            at: idx === 0 ? 'current' as const : 'next' as const,
            target: idx === 0 ? block : newBlocks[idx - 1],
            current: b
        }))

        return effect.compose(
            effect.update(updateEffects),
            effect.caret(lastBlock.id, lastInline.id, lastBlock.text.length, 'start')
        )
    }

    public deleteMultiBlock(
        startBlockId: string,
        startInlineId: string,
        startPosition: number,
        endBlockId: string,
        endInlineId: string,
        endPosition: number
    ): AstApplyEffect | null {
        const { ast, query, parser, effect } = this.context
      
        const startBlock = query.getBlockById(startBlockId)
        const startInline = query.getInlineById(startInlineId)
        const endBlock = query.getBlockById(endBlockId)
        const endInline = query.getInlineById(endInlineId)
        if (!startBlock || !startInline || !endBlock || !endInline) return null

        const flat = query.flattenBlocks(ast.blocks)
      
        const startFlatIndex = flat.findIndex(e => e.block.id === startBlockId)
        const endFlatIndex   = flat.findIndex(e => e.block.id === endBlockId)
        if (startFlatIndex === -1 || endFlatIndex === -1) return null
      
        const a = Math.min(startFlatIndex, endFlatIndex)
        const b = Math.max(startFlatIndex, endFlatIndex)
      
        const startEntry = flat[a]
        const endEntry   = flat[b]

        const startInlineIndex = startBlock.inlines.findIndex(i => i.id === startInlineId)
        const endInlineIndex   = endBlock.inlines.findIndex(i => i.id === endInlineId)
        if (startInlineIndex === -1 || endInlineIndex === -1) return null

        const textBefore =
            startBlock.inlines
                .slice(0, startInlineIndex)
                .map(i => i.text.symbolic)
                .join('') +
            startInline.text.symbolic.slice(0, startPosition)
        
        const textAfter =
            endInline.text.symbolic.slice(endPosition) +
            endBlock.inlines
                .slice(endInlineIndex + 1)
                .map(i => i.text.symbolic)
                .join('')

        const text = textBefore + textAfter

        const newBlocks = parser.reparseTextFragment(text, startBlock.position.start)
        if (newBlocks.length === 0) return null
    
        const getContainer = (entry: any): Block[] => {
        if (entry.parent && 'blocks' in entry.parent) return entry.parent.blocks
            return ast.blocks
        }
    
        const blocksToRemove: Block[] = []
    
        for (let fi = b; fi > a; fi--) {
            const entry = flat[fi]
            const container = getContainer(entry)
            blocksToRemove.push(entry.block)
            container.splice(entry.index, 1)
        }
    
        const startContainer = getContainer(startEntry)
        startContainer.splice(startEntry.index, 1, ...newBlocks)
    
        const lastBlock = newBlocks[newBlocks.length - 1]
        const lastInline = query.getFirstInline([lastBlock])
        if (!lastInline) return null
    
        const updateEffects = newBlocks.map((b, idx) => {
            if (idx === 0) {
                return {
                at: 'current' as const,
                target: startBlock,
                current: b,
                }
            }
        
            return {
                at: 'next' as const,
                target: idx === 1 ? startBlock : newBlocks[idx - 1],
                current: b,
            }
        })

        return effect.compose(
            effect.update(updateEffects, blocksToRemove),
            effect.caret(lastBlock.id, lastInline.id, lastBlock.text.length, 'start')
        )
    }
    
    public toggleTask(blockId: string, inlineId: string, caretPosition: number): AstApplyEffect | null {
        const { query, effect } = this.context

        const block = query.getBlockById(blockId) as TaskListItem
        if (!block || block.type !== 'taskListItem') return null

        block.checked = !block.checked
        return effect.compose(effect.update([{ at: 'current', target: block, current: block }]), effect.caret(blockId, inlineId, caretPosition, 'start'))
    }

    public inputCodeBlock(blockId: string, inlineId: string, text: string, caretPosition: number): AstApplyEffect | null {
        const { query, effect } = this.context

        const block = query.getBlockById(blockId) as CodeBlock
        if (!block || block.type !== 'codeBlock') return null

        const inline = query.getInlineById(inlineId)
        if (!inline) return null

        if (inline.type === 'text') {
            const hasLeadingNewline = text.startsWith('\n')
            const contentStart = hasLeadingNewline ? 1 : 0
            
            let newSymbolic = text
            if (!hasLeadingNewline && block.isFenced) {
                newSymbolic = '\n' + text
            }
            
            const content = newSymbolic.slice(contentStart)
            if (content.length === 0) {
                newSymbolic = (block.isFenced ? '\n' : '') + '\u200B'
            }
            
            inline.text.symbolic = newSymbolic
            inline.text.semantic = newSymbolic.slice(contentStart)
            inline.position.end = inline.position.start + newSymbolic.length

            block.text = inline.text.semantic.replace(/^\u200B$/, '')
            block.position.end = block.position.start + this.calculateCodeBlockLength(block)

            return effect.compose(
                effect.update([{ at: 'current', target: block, current: block }]),
                effect.caret(block.id, inline.id, caretPosition + 1, 'start')
            )
        }

        if (inline.type === 'marker') {
            const symbolicText = inline.text.symbolic
            const beforeCaret = symbolicText.slice(0, caretPosition - 1)
            const afterCaret = symbolicText.slice(caretPosition)
            const newSymbolic = beforeCaret + afterCaret

            inline.text.symbolic = newSymbolic
            inline.text.semantic = newSymbolic.replace(/^\u200B$/, '')
            inline.position.end = inline.position.start + newSymbolic.length

            const newText = block.inlines.map(i => i.text.symbolic).join('')
            const newBlocks = this.context.parser.reparseTextFragment(newText, block.position.start)
            if (newBlocks.length === 0) return null

            const newBlock = newBlocks[0]
            if (!newBlock) return null

            const entry = this.context.query.flattenBlocks(this.context.ast.blocks).find(e => e.block.id === block.id)
            if (!entry) return null

            const newCaretPosition = caretPosition - 1

            this.context.ast.blocks.splice(entry.index, 1, ...newBlocks)

            return effect.compose(
                effect.update([{ at: 'current', target: block, current: newBlock }]),
                effect.caret(newBlock.id, newBlock.inlines[newBlock.inlines.length - 1].id, newCaretPosition, 'start')
            )
        }

        return null
    }

    public splitCodeBlock(blockId: string, inlineId: string, caretPosition: number): AstApplyEffect | null {
        const { query, effect } = this.context

        const block = query.getBlockById(blockId) as CodeBlock
        if (!block || block.type !== 'codeBlock') return null

        const inline = query.getInlineById(inlineId)
        if (!inline || inline.type !== 'text') return null

        const symbolicText = inline.text.symbolic
        const hasLeadingNewline = symbolicText.startsWith('\n')
        const contentStart = hasLeadingNewline ? 1 : 0

        let actualPosition = caretPosition

        if (hasLeadingNewline && caretPosition === 0) {
            actualPosition = 1
        } else {
            actualPosition = Math.max(caretPosition, contentStart)
        }

        const beforeCaret = symbolicText.slice(0, actualPosition)
        const afterCaret = symbolicText.slice(actualPosition)

        const newSymbolic = beforeCaret + '\n' + afterCaret

        inline.text.symbolic = newSymbolic
        inline.text.semantic = newSymbolic.replace(/^\u200B$/, '')
        inline.position.end = inline.position.start + newSymbolic.length

        block.text = inline.text.semantic
        block.position.end = block.position.start + this.calculateCodeBlockLength(block)

        const newCaretPosition = actualPosition + 1

        return effect.compose(
            effect.update([{ at: 'current', target: block, current: block }]),
            effect.caret(block.id, inline.id, newCaretPosition, 'start')
        )
    }

    private syncFencedCodeBlockFromOpenMarker(block: CodeBlock) {
        if (!block.isFenced) return

        const marker = block.inlines?.find(i => i.type === 'marker') ?? null
        if (!marker) return

        let symbolic = marker.text.symbolic ?? ''

        const hasTrailingNewline = symbolic.endsWith('\n')
        if (hasTrailingNewline) symbolic = symbolic.slice(0, -1)

        const m = symbolic.match(/^(\s{0,3})(```+|~~~+)(.*)$/)
        if (!m) return

        const indent = m[1].length
        const fence = m[2]
        const rawInfo = m[3] ?? ''
        const info = rawInfo.trim()

        block.openIndent = indent
        block.fenceChar = fence.charAt(0) as any
        block.fenceLength = fence.length

        if (info.length > 0) {
            block.infoString = info
            block.language = info
        } else {
            block.infoString = undefined
            block.language = undefined
        }

        marker.text.symbolic = `${' '.repeat(indent)}${fence}${info ? info : ''}\n`
        marker.text.semantic = ''
    }

    public mergeCodeBlockContent(blockId: string, inlineId: string, caretPosition: number): AstApplyEffect | null {
        const { query, transform, effect } = this.context

        const block = query.getBlockById(blockId) as CodeBlock
        if (!block || block.type !== 'codeBlock') return null

        const inline = query.getInlineById(inlineId)
        if (!inline) return null

        console.log('mergeCodeBlockContent caretPosition', caretPosition, JSON.stringify(inline.text.symbolic, null, 2))

        if (inline.type === 'marker') {
            console.log('mergeCodeBlockContent marker')
            if (caretPosition <= 0) return null
            if (caretPosition > inline.text.symbolic.length) return null

            const symbolicText = inline.text.symbolic
            const beforeCaret = symbolicText.slice(0, caretPosition - 1)
            const afterCaret = symbolicText.slice(caretPosition)
            const newSymbolic = beforeCaret + afterCaret

            inline.text.symbolic = newSymbolic
            inline.text.semantic = ''
            inline.position.end = inline.position.start + newSymbolic.length

            if (block.isFenced) {
                this.syncFencedCodeBlockFromOpenMarker(block)
            }

            const newCaretPosition = Math.max(0, caretPosition - 1)

            const caretPositionInBlock = (block.inlines ?? [])
                .slice(0, (block.inlines ?? []).findIndex(i => i.id === inline.id))
                .reduce((s, i) => s + i.text.symbolic.length, 0)
                + newCaretPosition

            const newText = (block.inlines ?? []).map(i => i.text.symbolic).join('')
            const detectedBlock = detectBlockType(newText)

            const currentType = block.type as Block['type']
            const blockTypeChanged =
                detectedBlock.type !== currentType ||
                (
                    detectedBlock.type === 'heading' &&
                    currentType === 'heading' &&
                    detectedBlock.level !== (block as any).level
                )

            const ignoreTypes = ['blankLine', 'table']
            if (blockTypeChanged && !ignoreTypes.includes(detectedBlock.type)) {
                return transform.transformBlock(newText, block as any, detectedBlock, caretPositionInBlock, [])
            }

            block.position.end = block.position.start + this.calculateCodeBlockLength(block)

            return effect.compose(
                effect.update([{ at: 'current', target: block, current: block }]),
                effect.caret(block.id, inline.id, newCaretPosition, 'start')
            )
        }

        if (inline.type === 'text') {
            const symbolicText = inline.text.symbolic

            const beforeCaret = symbolicText.slice(0, caretPosition - 1)
            const afterCaret = symbolicText.slice(caretPosition)
            const newSymbolic = beforeCaret + afterCaret

            inline.text.symbolic = newSymbolic
            inline.text.semantic = newSymbolic.slice(0)
            inline.position.end = inline.position.start + newSymbolic.length

            block.text = inline.text.semantic.replace(/^\u200B$/, '')
            block.position.end = block.position.start + this.calculateCodeBlockLength(block)

            const newCaretPosition = caretPosition - 1

            return effect.compose(
                effect.update([{ at: 'current', target: block, current: block }]),
                effect.caret(block.id, inline.id, newCaretPosition, 'start')
            )
        }

        return null
    }

    public splitCodeBlockFromMarker(blockId: string, inlineId: string, caretPosition: number): AstApplyEffect | null {
        const { query, transform, effect } = this.context

        const block = query.getBlockById(blockId) as CodeBlock
        if (!block || block.type !== 'codeBlock') return null
        if (!block.isFenced) return null

        const inline = query.getInlineById(inlineId)
        if (!inline || inline.type !== 'marker') return null

        const markerInline = inline
        const textInline = block.inlines?.find(i => i.type === 'text') ?? null
        if (!textInline) return null

        const markerText = markerInline.text.symbolic ?? ''
        if (caretPosition < 0 || caretPosition > markerText.length) return null

        const before = markerText.slice(0, caretPosition)
        const after = markerText.slice(caretPosition)

        const beforeNoNl = before.endsWith('\n') ? before.slice(0, -1) : before

        const merged = (block.inlines ?? []).map(i => i.text.symbolic).join('')
        const newText = before + '\n' + after + merged.slice(markerText.length)

        const detected = detectBlockType(newText)

        const ignoreTypes = ['blankLine', 'table']
        if (!ignoreTypes.includes(detected.type) && detected.type !== 'codeBlock') {
            return transform.transformBlock(newText, block as any, detected, caretPosition + 1, [])
        }

        const m = beforeNoNl.match(/^(\s{0,3})(```+|~~~+)(.*)$/)
        if (!m) {
            return transform.transformBlock(newText, block as any, { type: 'paragraph' } as any, caretPosition + 1, [])
        }

        const moved = after.replace(/\n$/, '')

        const current = textInline.text.semantic === '\u200B' ? '' : (textInline.text.semantic ?? '')

        const indent = block.openIndent ?? 0
        let info = (block.infoString ? String(block.infoString) : (block.language ? String(block.language) : '')).trim()
        const nlIndex = indent + (block.fenceLength ?? 3) + info.length

        const atOpenNewline = caretPosition === nlIndex
        const next = atOpenNewline ? ('\n' + moved + current) : (moved + current)

        markerInline.text.symbolic = beforeNoNl + '\n'
        markerInline.text.semantic = ''
        markerInline.position.end = markerInline.position.start + markerInline.text.symbolic.length

        const rawInfo = m[3] ?? ''
        info = rawInfo.trim()

        if (info.length > 0) {
            block.infoString = info
            block.language = info
        } else {
            block.infoString = undefined
            block.language = undefined
        }

        textInline.text.symbolic = next.length === 0 ? '\u200B' : next
        textInline.text.semantic = next
        textInline.position.start = markerInline.position.end
        textInline.position.end = textInline.position.start + textInline.text.symbolic.length

        block.text = next
        block.position.end = block.position.start + this.calculateCodeBlockLength(block)

        return effect.compose(
            effect.update([{ at: 'current', target: block, current: block }]),
            effect.caret(block.id, textInline.id, atOpenNewline ? 1 : 0, 'start')
        )
    }


    public exitCodeBlock(blockId: string, direction: 'above' | 'below'): AstApplyEffect | null {
        const { ast, query, parser, effect } = this.context

        const block = query.getBlockById(blockId) as CodeBlock
        if (!block || block.type !== 'codeBlock') return null

        const blockIndex = ast.blocks.findIndex(b => b.id === blockId)
        if (blockIndex === -1) return null

        const paragraph: Block = {
            id: uuid(),
            type: 'paragraph',
            text: '',
            position: { start: 0, end: 0 },
            inlines: [],
        }
        paragraph.inlines = parser.inline.parseInline('', paragraph.id, 'paragraph', 0)
        paragraph.inlines.forEach((i: Inline) => i.blockId = paragraph.id)

        if (direction === 'above') {
            ast.blocks.splice(blockIndex, 0, paragraph)
            const focusInline = paragraph.inlines[0]
            return effect.compose(
                effect.update([{ at: 'previous', target: block, current: paragraph }]),
                effect.caret(paragraph.id, focusInline.id, 0, 'start')
            )
        } else {
            ast.blocks.splice(blockIndex + 1, 0, paragraph)
            const focusInline = paragraph.inlines[0]
            return effect.compose(
                effect.update([{ at: 'next', target: block, current: paragraph }]),
                effect.caret(paragraph.id, focusInline.id, 0, 'start')
            )
        }
    }

    public unwrapCodeBlock(blockId: string): AstApplyEffect | null {
        const { ast, query, parser, effect } = this.context

        const block = query.getBlockById(blockId) as CodeBlock
        if (!block || block.type !== 'codeBlock') return null

        const blockIndex = ast.blocks.findIndex(b => b.id === blockId)
        if (blockIndex === -1) return null

        const content = block.text || ''
        const lines = content.split('\n')
        
        const newBlocks: Block[] = []
        for (const line of lines) {
            const para: Block = {
                id: uuid(),
                type: 'paragraph',
                text: line,
                position: { start: 0, end: line.length },
                inlines: [],
            }
            para.inlines = parser.inline.parseInline(line, para.id, 'paragraph', 0)
            para.inlines.forEach((i: Inline) => i.blockId = para.id)
            newBlocks.push(para)
        }

        if (newBlocks.length === 0) {
            const para: Block = {
                id: uuid(),
                type: 'paragraph',
                text: '',
                position: { start: 0, end: 0 },
                inlines: [],
            }
            para.inlines = parser.inline.parseInline('', para.id, 'paragraph', 0)
            para.inlines.forEach((i: Inline) => i.blockId = para.id)
            newBlocks.push(para)
        }

        ast.blocks.splice(blockIndex, 1, ...newBlocks)

        const firstBlock = newBlocks[0]
        const focusInline = firstBlock.inlines[0]
        if (!focusInline) return null

        const updateEffects = newBlocks.map((b, idx) => ({
            at: idx === 0 ? 'current' as const : 'next' as const,
            target: idx === 0 ? block : newBlocks[idx - 1],
            current: b
        }))

        return effect.compose(
            effect.update(updateEffects, [block]),
            effect.caret(firstBlock.id, focusInline.id, 0, 'start')
        )
    }

    public setCodeBlockLanguage(blockId: string, language: string | undefined): AstApplyEffect | null {
        const { query, effect } = this.context

        const block = query.getBlockById(blockId) as CodeBlock
        if (!block || block.type !== 'codeBlock') return null

        block.language = language
        block.infoString = language

        const markerInline = block.inlines.find(i => i.type === 'marker')
        if (markerInline && block.isFenced) {
            const fenceChar = block.fenceChar ?? '`'
            const fenceLength = block.fenceLength ?? 3
            const indent = block.openIndent ?? 0
            const fence = fenceChar.repeat(fenceLength)
            markerInline.text.symbolic = ' '.repeat(indent) + fence + (language || '')
        }

        const textInline = block.inlines.find(i => i.type === 'text')
        if (!textInline) return null

        return effect.compose(
            effect.update([{ at: 'current', target: block, current: block }]),
            effect.caret(block.id, textInline.id, 1, 'start')
        )
    }

    private calculateCodeBlockLength(block: CodeBlock): number {
        if (!block.isFenced) {
            const lines = block.text.split('\n')
            return lines.reduce((sum, line, idx) => {
                return sum + 4 + line.length + (idx < lines.length - 1 ? 1 : 0)
            }, 0)
        }

        const fenceChar = block.fenceChar ?? '`'
        const fenceLength = block.fenceLength ?? 3
        const indent = block.openIndent ?? 0
        const fence = fenceChar.repeat(fenceLength)
        const lang = block.language || ''
        
        const open = ' '.repeat(indent) + fence + lang
        const content = '\n' + (block.text || '\u200B')
        const close = block.close || fence
        
        return open.length + content.length + (close ? close.length : 0)
    }
}

export default Edit
