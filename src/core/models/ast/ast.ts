import AstNormalizer from './AstNormalizer'
import AstMutation from './AstMutation'
import AstQuery from './AstQuery'
import ParseAst from '../parse/parseAst'
import { AstApplyEffect, Block, Inline, List, ListItem } from '../../types'
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
    }

    public get query() {
        return new AstQuery(this.blocks)
    }

    public normalize() {
        this.normalizer.apply(this.blocks)
        this.text = this.normalizer.text
    }

    private transformBlock(block: Block, text: string): AstApplyEffect | null {
        const flat = this.query.flattenBlocks(this.blocks)
        const index = flat.findIndex(b => b.id === block.id)
    
        const newBlocks = this.parser.reparseTextFragment(text, block.position.start)
    
        const inline = this.query.getFirstInline(newBlocks)
        if (!inline) return null
    
        this.blocks.splice(index, 1, ...newBlocks)
    
        return {
            renderEffect: {
                type: 'update',
                render: {
                    remove: [block],
                    insert: [{
                        at: index > 0 ? 'next' : 'current',
                        target: index > 0 ? this.blocks[index - 1] : newBlocks[0],
                        current: newBlocks[0],
                    }],
                },
            },
            caretEffect: {
                type: 'restore',
                caret: {
                    blockId: inline.blockId,
                    inlineId: inline.id,
                    position: inline.position.start,
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
        const detectedBlockType = this.parser.block.detectType(newText)

        const blockTypeChanged =
            detectedBlockType.type !== block.type ||
            (detectedBlockType.type === 'heading' && block.type === 'heading' && detectedBlockType.level !== block.level)
        
        const ignoreTypes = ['blankLine', 'heading', 'thematicBreak', 'codeBlock']
        if (blockTypeChanged && !ignoreTypes.includes(detectedBlockType.type)) {
            return this.transformBlock(block, newText)
        }
        
        const newInlines = this.parser.inline.lexInline(newText, block.id, block.position.start)
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

        const newListItem: ListItem = {
            id: uuid(),
            type: 'listItem',
            blocks: [right],
            inlines: [],
            text: '',
            position: {
                start: listItem.position.end,
                end: listItem.position.end,
            },
        }

        const index = list.blocks.findIndex(b => b.id === listItem.id)
        list.blocks.splice(index + 1, 0, newListItem)

        listItem.text = this.query.getListItemText(listItem)
        newListItem.text = this.query.getListItemText(newListItem)

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
                    blockId: right.id,
                    inlineId: right.inlines[0].id,
                    position: 0,
                    affinity: 'start',
                },
            },
        }
    }

    public mergeInline(inlineAId: string, inlineBId: string): AstApplyEffect | null {
        const inlineA = this.query.getInlineById(inlineAId)
        const inlineB = this.query.getInlineById(inlineBId)
        if (!inlineA || !inlineB) return null

        const flattened = this.query.flattenInlines(this.blocks)
        const iA = flattened.findIndex(i => i.id === inlineAId)
        const iB = flattened.findIndex(i => i.id === inlineBId)
        if (iA === -1 || iB === -1) return null

        const [leftInline, rightInline] =
            iA < iB ? [inlineA, inlineB] : [inlineB, inlineA]

        const result = this.mutation.mergeInlinePure(leftInline, rightInline)
        if (!result) return null

        const { leftBlock, mergedInline, removedBlock } = result

        let removedBlocks: Block[] = []
        if (removedBlock) {
            removedBlocks = this.mutation.removeBlockCascade(removedBlock)
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
                    position: removedBlock ? leftInline.text.symbolic.length : leftInline.text.symbolic.length - 1,
                    affinity: 'start',
                },
            },
        }
    }

    public mergeMarker(blockId: string): AstApplyEffect | null {
        const list = this.query.getBlockById(blockId)
        if (!list || list.type !== 'list') return null

        const listIndex = this.blocks.findIndex(b => b.id === list.id)
        if (listIndex === -1) return null

        const listItem = list.blocks[0] as ListItem
        if (!listItem || listItem.blocks.length === 0) return null

        const paragraph = this.mutation.listItemToParagraph(listItem)

        if (list.blocks.length === 1) {
            this.blocks.splice(listIndex, 1, paragraph)

            return {
                renderEffect: {
                    type: 'update',
                    render: {
                        remove: [list],
                        insert: [
                            {
                                at: 'current',
                                target: list,
                                current: paragraph,
                            },
                        ],
                    },
                },
                caretEffect: {
                    type: 'restore',
                    caret: {
                        blockId: paragraph.id,
                        inlineId: paragraph.inlines[0].id,
                        position: 0,
                        affinity: 'start',
                    },
                },
            }
        }

        list.blocks.splice(0, 1)

        this.blocks.splice(
            listIndex,
            1,
            paragraph,
            list
        )

        return {
            renderEffect: {
                type: 'update',
                render: {
                    remove: [listItem],
                    insert: [
                        {
                            at: 'previous',
                            target: list,
                            current: paragraph,
                        },
                    ],
                },
            },
            caretEffect: {
                type: 'restore',
                caret: {
                    blockId: paragraph.id,
                    inlineId: paragraph.inlines[0].id,
                    position: 0,
                    affinity: 'start',
                },
            },
        }
    }
}

export default AST
