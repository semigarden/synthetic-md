import AstNormalizer from './AstNormalizer'
import AstMutation from './AstMutation'
import AstQuery from './AstQuery'
import ParseAst from '../parse/parseAst'
import { AstApplyEffect, DetectedBlock, Block, BlockQuote, CodeBlock, Inline, List, ListItem, Table, TableCell, TableRow } from '../../types'
import { uuid } from '../../utils/utils'

class AST {
    public text = ''
    public blocks: Block[] = []

    private parser = new ParseAst()
    private normalizer = new AstNormalizer()
    private mutation = new AstMutation(this, this.parser)

    constructor(text = '') {
        this.text = text
    }

    setText(text: string) {
        this.text = text
        this.blocks = this.parser.parse(text)
        console.log('blocks', JSON.stringify(this.blocks, null, 2))
    }

    public get query() {
        return new AstQuery(this.blocks)
    }

    public normalize() {
        this.normalizer.apply(this.blocks)
        this.text = this.normalizer.text
    }

    private transformBlock(text: string, block: Block, detectedBlock: DetectedBlock, caretPosition: number | null = null): AstApplyEffect | null {
        const flat = this.query.flattenBlocks(this.blocks)
        const entry = flat.find(b => b.block.id === block.id)
        if (!entry) return null

        const newBlocks = this.parser.reparseTextFragment(text, block.position.start)

        const inline = this.query.getFirstInline(newBlocks)
        if (!inline) return null

        if (entry.parent && entry.parent.type === 'list' && block.type === 'listItem' && block.type !== detectedBlock.type) {
            const list = entry.parent as List
            const listEntry = flat.find(b => b.block.id === list.id)
            if (!listEntry) return null
        
            if (list.blocks.length > 1) {
                list.blocks.splice(entry.index, 1)
                this.blocks.splice(listEntry.index, 0, ...newBlocks)

                return {
                    renderEffect: {
                        type: 'update',
                        render: {
                            remove: [entry.block],
                            insert: [{
                                at: 'previous',
                                target: list,
                                current: newBlocks[0],
                            }],
                        },
                    },
                    caretEffect: {
                        type: 'restore',
                        caret: {
                            blockId: inline.blockId,
                            inlineId: inline.id,
                            position: caretPosition ?? inline.position.start,
                            affinity: 'start',
                        },
                    },
                }
            } else {
                this.blocks.splice(listEntry.index, 1, ...newBlocks)

                return {
                    renderEffect: {
                        type: 'update',
                        render: {
                            remove: [],
                            insert: [{
                                at: 'current',
                                target: list,
                                current: newBlocks[0],
                            }],
                        },
                    },
                    caretEffect: {
                        type: 'restore',
                        caret: {
                            blockId: inline.blockId,
                            inlineId: inline.id,
                            position: caretPosition ?? inline.position.start,
                            affinity: 'start',
                        },
                    },
                }
            }
        }
    
        this.blocks.splice(entry.index, 1, ...newBlocks)

        return {
            renderEffect: {
                type: 'update',
                render: {
                    remove: [],
                    insert: [{
                        at: 'current',
                        target: block,
                        current: newBlocks[0],
                    }],
                },
            },
            caretEffect: {
                type: 'restore',
                caret: {
                    blockId: inline.blockId,
                    inlineId: inline.id,
                    position: caretPosition ?? inline.position.start,
                    affinity: 'start',
                },
            },
        }
    } 

    public input(blockId: string, inlineId: string, text: string, caretPosition: number): AstApplyEffect | null {
        const block = this.query.getBlockById(blockId)
        if (!block) return null

        const inline = this.query.getInlineById(inlineId)
        if (!inline) return null

        const inlineIndex = block.inlines.findIndex(i => i.id === inlineId)
        const absoluteCaretPosition =
            block.inlines
                .slice(0, inlineIndex)
                .reduce((sum, i) => sum + i.text.symbolic.length, 0)
            + caretPosition

        const newText = block.inlines.slice(0, inlineIndex).map(i => i.text.symbolic).join('') + text + block.inlines.slice(inlineIndex + 1).map(i => i.text.symbolic).join('')
        const detectedBlock = this.parser.block.detectType(newText)

        const blockTypeChanged =
            detectedBlock.type !== block.type ||
            (detectedBlock.type === 'heading' && block.type === 'heading' && detectedBlock.level !== block.level)
        
        const ignoreTypes = ['blankLine', 'codeBlock', 'table']
        if (blockTypeChanged && !ignoreTypes.includes(detectedBlock.type)) {
            if (detectedBlock.type === 'listItem') caretPosition = 0
            return this.transformBlock(newText, block, detectedBlock, caretPosition)
        }
        
        const newInlines = this.parser.inline.lexInline(newText, block.id, block.type, block.position.start)
        const { inline: newInline, position } = this.query.getInlineAtPosition(newInlines, absoluteCaretPosition) ?? { inline: null, position: 0 }
        if (!newInline) return null

        block.text = newInlines.map((i: Inline) => i.text.symbolic).join('')
        block.position = { start: block.position.start, end: block.position.start + block.text.length }
        block.inlines = newInlines
        newInlines.forEach((i: Inline) => i.blockId = block.id)

        return {
            renderEffect: {
                type: 'update',
                render: {
                    remove: [],
                    insert: [
                        {
                            at: 'current',
                            target: block,
                            current: block,
                        },
                    ],
                },
            },
            caretEffect: {
                type: 'restore',
                caret: {
                    blockId: block.id,
                    inlineId: newInline.id,
                    position: position,
                    affinity: 'start'
                },
            },
        }
    }

    public split(blockId: string, inlineId: string, caretPosition: number): AstApplyEffect | null {
        const block = this.query.getBlockById(blockId)
        if (!block) return null

        const result = this.mutation.splitBlockPure(block, inlineId, caretPosition)
        if (!result) return null

        const { left, right } = result

        const index = this.blocks.findIndex(b => b.id === block.id)
        this.blocks.splice(index, 1, left, right)

        return {
            renderEffect: {
                type: 'update',
                render: {
                    remove: [],
                    insert: [
                        { at: 'current', target: block, current: left },
                        { at: 'next', target: block, current: right },
                    ],
                },
            },
            caretEffect: {
                type: 'restore',
                caret: {
                    blockId: right.id,
                    inlineId: right.inlines[0].id,
                    position: 0,
                    affinity: 'start',
                },
            },
        }
    }

    public splitListItem(listItemId: string, blockId: string, inlineId: string, caretPosition: number): AstApplyEffect | null {
        const listItem = this.query.getBlockById(listItemId) as ListItem
        if (!listItem) return null

        const list = this.query.getParentBlock(listItem) as List
        if (!list) return null

        const block = listItem.blocks.find(b => b.id === blockId)
        if (!block) return null

        const result = this.mutation.splitBlockPure(block, inlineId, caretPosition)
        if (!result) return null

        const { left, right } = result

        listItem.blocks = [left]

        const index = list.blocks.findIndex(b => b.id === listItem.id)
        listItem.text = this.query.getListItemText(listItem, list)

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

        const marker = this.query.getListItemMarker(list, index + 1)

        newListItem.inlines.unshift({
            id: uuid(),
            type: 'marker',
            text: {
                symbolic: marker,
                semantic: '',
            },
            position: { start: 0, end: marker.length },
        } as Inline)

        const bodyText = [right]
            .map(b => b.inlines.map(i => i.text.symbolic).join(''))
            .join('')

        const bodyBlocks = this.parser.reparseTextFragment(
            bodyText,
            newListItem.position.start + marker.length
        )

        newListItem.text = marker
        newListItem.blocks = bodyBlocks

        list.blocks.splice(index + 1, 0, newListItem)

        return {
            renderEffect: {
                type: 'update',
                render: {
                    remove: [],
                    insert: [
                        { at: 'current', target: listItem, current: listItem },
                        { at: 'next', target: listItem, current: newListItem },
                    ],
                },
            },
            caretEffect: {
                type: 'restore',
                caret: {
                    blockId: newListItem.blocks[0].id,
                    inlineId: newListItem.blocks[0].inlines[0].id,
                    position: 0,
                    affinity: 'start',
                },
            },
        }
    }

    public mergeInline(inlineAId: string, inlineBId: string): AstApplyEffect | null {
        const flattened = this.query.flattenInlines(this.blocks)
        const iA = flattened.findIndex(i => i.inline.id === inlineAId)
        const iB = flattened.findIndex(i => i.inline.id === inlineBId)
        if (iA === -1 || iB === -1) return null

        const [leftInline, rightInline] = iA < iB ? [flattened[iA].inline, flattened[iB].inline] : [flattened[iB].inline, flattened[iA].inline]

        const result = this.mutation.mergeInlinePure(leftInline, rightInline)

        if (!result) return null

        const { leftBlock, mergedInline, removedBlock } = result

        let removedBlocks: Block[] = []
        if (removedBlock) {
            removedBlocks = this.mutation.removeBlockCascade(removedBlock)
        }

        const caretPositionInMergedInline = removedBlock ? leftInline.text.symbolic.length : leftInline.text.symbolic.length - 1
        const caretPosition = leftBlock.inlines
            .slice(0, leftBlock.inlines.findIndex(i => i.id === mergedInline.id))
            .reduce((s, i) => s + i.text.symbolic.length, 0)
        + caretPositionInMergedInline

        const newText = leftBlock.inlines.map(i => i.text.symbolic).join('')
        const detectedBlock = this.parser.block.detectType(newText)

        const blockTypeChanged =
            detectedBlock.type !== leftBlock.type ||
            (detectedBlock.type === 'heading' && leftBlock.type === 'heading' && detectedBlock.level !== leftBlock.level)

        const ignoreTypes = ['blankLine', 'codeBlock', 'table']
        if (blockTypeChanged && !ignoreTypes.includes(detectedBlock.type)) {
            return this.transformBlock(newText, leftBlock, detectedBlock, caretPosition)
        }

        return {
            renderEffect: {
                type: 'update',
                render: {
                    remove: removedBlocks,
                    insert: [
                        {
                            at: 'current',
                            target: leftBlock,
                            current: leftBlock,
                        },
                    ],
                },
            },
            caretEffect: {
                type: 'restore',
                caret: {
                    blockId: leftBlock.id,
                    inlineId: mergedInline.id,
                    position: caretPositionInMergedInline,
                    affinity: 'start',
                },
            },
        }
    }

    public indentListItem(listItemId: string): AstApplyEffect | null {
        const listItem = this.query.getBlockById(listItemId) as ListItem
        if (!listItem) return null
    
        const list = this.query.getListFromBlock(listItem)
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
    
        return {
            renderEffect: {
                type: 'update',
                render: {
                    remove: [{ ...listItem, id: oldId }],
                    insert: [
                        { at: 'current', target: prev, current: prev },
                    ],
                },
            },
            caretEffect: {
                type: 'restore',
                caret: {
                    blockId: listItem.id,
                    inlineId: listItem.blocks[0].inlines[0].id,
                    position: 0,
                    affinity: 'start',
                },
            },
        }
    }

    public outdentListItem(listItemId: string): AstApplyEffect | null {
        const listItem = this.query.getBlockById(listItemId) as ListItem
        if (!listItem) return null

        const sublist = this.query.getListFromBlock(listItem)
        if (!sublist) return null

        const parentListItem = this.query.getParentBlock(sublist) as ListItem | null
        if (!parentListItem || parentListItem.type !== 'listItem') return null

        const parentList = this.query.getListFromBlock(parentListItem)
        if (!parentList) return null

        const sublistIndex = sublist.blocks.indexOf(listItem)
        const parentIndex = parentList.blocks.indexOf(parentListItem)

        sublist.blocks.splice(sublistIndex, 1)

        if (sublist.blocks.length === 0) {
            const sublistIdx = parentListItem.blocks.indexOf(sublist)
            parentListItem.blocks.splice(sublistIdx, 1)
        }

        parentList.blocks.splice(parentIndex + 1, 0, listItem)

        return {
            renderEffect: {
                type: 'update',
                render: {
                    remove: [],
                    insert: [
                        { at: 'current', target: parentListItem, current: parentListItem },
                        { at: 'next', target: parentListItem, current: listItem },
                    ],
                },
            },
            caretEffect: {
                type: 'restore',
                caret: {
                    blockId: listItem.id,
                    inlineId: listItem.blocks[0].inlines[0].id,
                    position: 0,
                    affinity: 'start',
                },
            },
        }
    }
}

export default AST
