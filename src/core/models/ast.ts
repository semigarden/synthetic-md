import { buildAst, parseInlineContent } from '../ast/ast'
import { AstApplyEffect, Block, Document, Inline, List, ListItem } from '../types'
import { uuid } from '../utils/utils'

class AST {
    public text = ''
    public ast: Document = buildAst('')

    constructor(text = '') {
        this.text = text
    }
  
    setText(text: string) {
        this.text = text

        // console.log('init ast', JSON.stringify(this.ast, null, 2))
    }

    getText() {
        return this.text
    }

    getAst() {
        return this.ast
    }

    createBlock(type: any, text: string, position: { start: number, end: number }, inlines: Inline[]): Block {
        const block: Block = {
            id: uuid(),
            type,
            text,
            position,
            inlines,
        }
        return block
    }

    getBlockById(id: string): Block | null {
        return this.findBlockByIdRecursive(id, this.ast?.blocks ?? [])
    }

    private findBlockByIdRecursive(targetId: string, blocks: Block[]): Block | null {
        for (const block of blocks) {
            if (block.id === targetId) {
                return block
            }
            if ('blocks' in block && block.blocks) {
                const found = this.findBlockByIdRecursive(targetId, block.blocks)
                if (found) return found
            }
        }
        return null
    }

    getInlineById(id: string): Inline | null {
        return this.findInlineByIdRecursive(id, this.ast?.blocks ?? [])
    }

    private findInlineByIdRecursive(targetId: string, blocks: Block[]): Inline | null {
        for (const block of blocks) {
            for (const inline of block.inlines) {
                if (inline.id === targetId) {
                    return inline
                }
            }

            if ('blocks' in block && block.blocks) {
                const found = this.findInlineByIdRecursive(targetId, block.blocks)
                if (found) return found
            }
        }
        return null
    }

    public getParentBlock(block: Block): Block | null {
        const flattenedBlocks = this.flattenBlocks(this.ast.blocks)
        const parentBlock = flattenedBlocks.find(b => b.type === 'list' && b.blocks?.some(b => b.id === block.id)) ?? flattenedBlocks.find(b => b.type === 'listItem' && b.blocks?.some(b => b.id === block.id))
        return parentBlock ?? null
    }

    public flattenBlocks(blocks: Block[], acc: Block[] = []): Block[] {
        for (const b of blocks) {
          acc.push(b)
          if ('blocks' in b && b.blocks) this.flattenBlocks(b.blocks, acc)
        }
        return acc
    }

    public flattenInlines(blocks: Block[]): Inline[] {
        const inlines: Inline[] = []
        for (const b of blocks) {
            inlines.push(...b.inlines)
            if ('blocks' in b && b.blocks) inlines.push(...this.flattenInlines(b.blocks))
        }
        return inlines
    }

    public updateAST() {
        let globalPos = 0

        const updateBlock = (block: Block): string => {
            const start = globalPos
            let text = ''

            if (!('blocks' in block) || !block.blocks) {
                let localPos = 0

                for (const inline of block.inlines) {
                    if (!inline.id) inline.id = uuid()
                        const len = inline.text.symbolic.length
                        inline.position = {
                        start: localPos,
                        end: localPos + len,
                    }
                    localPos += len
                }

                text = block.inlines.map((i: Inline) => i.text.symbolic).join('')
                block.text = text
                block.position = { start, end: start + text.length }
                globalPos += text.length

                return text
            }

            if (block.type === 'list') {
                const parts: string[] = []

                for (let i = 0; i < block.blocks.length; i++) {
                    const item = block.blocks[i]
                    const itemText = updateBlock(item)
                    parts.push(itemText)

                    if (i < block.blocks.length - 1) {
                        parts.push('\n')
                        globalPos += 1
                    }
                }

                text = parts.join('')
            }

            else if (block.type === 'listItem') {
                const marker = '- '
                text += marker
                globalPos += marker.length

                const content = updateBlock(block.blocks[0])
                text += content
            }

            block.text = text
            block.position = { start, end: globalPos }

            return text
        }

        const parts: string[] = []
        for (let i = 0; i < this.ast.blocks.length; i++) {
            parts.push(updateBlock(this.ast.blocks[i]))
            if (i < this.ast.blocks.length - 1) {
                parts.push('\n')
                globalPos += 1
            }
        }

        this.text = parts.join('')



        // console.log('ast', JSON.stringify(ast, null, 2))
    }

    public split(blockId: string, inlineId: string, caretPosition: number): AstApplyEffect | null {
        const block = this.getBlockById(blockId)
        if (!block) return null

        const inline = this.getInlineById(inlineId)
        if (!inline) return null

        const inlineIndex = block.inlines.findIndex(i => i.id === inlineId)

        const previousText = inline.text.symbolic.slice(0, caretPosition)
        const nextText = inline.text.symbolic.slice(caretPosition)

        const beforeInlines = block.inlines.slice(0, inlineIndex)
        const afterInlines = block.inlines.slice(inlineIndex + 1)

        const previousInlines = parseInlineContent(previousText, block.id, block.position.start)
        const nextInlines = parseInlineContent(nextText, block.id, block.position.start + previousText.length).concat(afterInlines)

        block.text = previousText + beforeInlines.map(i => i.text.symbolic).join('')
        block.position = { start: block.position.start, end: block.position.start + previousText.length + beforeInlines.map(i => i.text.symbolic).join('').length }

        const newBlock = {
            id: uuid(),
            type: block.type,
            text: nextText + afterInlines.map(i => i.text.symbolic).join(''),
            inlines: [],
            position: { start: block.position.end, end: block.position.end + nextText.length + afterInlines.map(i => i.text.symbolic).join('').length }
        } as Block

        nextInlines.forEach(i => i.blockId = newBlock.id)
        newBlock.inlines.push(...nextInlines)

        block.inlines.splice(inlineIndex, 1)
        block.inlines.splice(inlineIndex, 0, ...previousInlines)
        
        this.ast.blocks.splice(this.ast.blocks.findIndex(b => b.id === block.id), 1, block, newBlock)

        return {
            render: {
                remove: [block],
                insert: [
                    {
                        at: 'current',
                        target: block,
                        current: block,
                    },
                    {
                        at: 'next',
                        target: block,
                        current: newBlock,
                    },
                ],
            },
            caret: {
                blockId: newBlock.id,
                inlineId: newBlock.inlines[0].id,
                position: 0,
                affinity: 'start'
            },
        }
    }

    public splitListItem(listItemId: string, blockId: string, inlineId: string, caretPosition: number): AstApplyEffect | null {
        const listItem = this.getBlockById(listItemId) as ListItem
        if (!listItem) return null

        const list = this.getParentBlock(listItem) as List
        if (!list) return null

        const split = this.split(blockId, inlineId, caretPosition)
        if (!split) return null

        const [previousBlock, nextBlock] = [split.render.insert[1].target, split.render.insert[1].current]
        const previousBlockIndex = this.ast.blocks.findIndex(b => b.id === previousBlock.id)

        const marker = listItem.text.match(/^[-*+]\s/)
        const newListItemText = marker?.[0] + nextBlock.text
        const newListItem = {
            id: uuid(),
            type: 'listItem',
            text: newListItemText,
            position: { start: listItem.position.end, end: listItem.position.end + newListItemText.length },
            blocks: [nextBlock],
            inlines: [],
        } as ListItem

        listItem.text = listItem.text.slice(0, -previousBlock.text.length)
        listItem.blocks = [previousBlock]
        list.blocks.splice(list.blocks.findIndex(b => b.id === listItem.id), 1, listItem, newListItem)

        this.ast.blocks.splice(previousBlockIndex, 2, list)

        return {
            render: {
                remove: [],
                insert: [
                    {
                        at: 'current',
                        target: listItem,
                        current: listItem,
                    },
                    {
                        at: 'next',
                        target: listItem,
                        current: newListItem,
                    },
                ],
            },
            caret: {
                blockId: nextBlock.id,
                inlineId: nextBlock.inlines[0].id,
                position: 0,
                affinity: 'start'
            },
        }
    }

    public mergeInline(inlineAId: string, inlineBId: string): AstApplyEffect | null {
        const inlineA = this.getInlineById(inlineAId)
        const inlineB = this.getInlineById(inlineBId)
        if (!inlineA || !inlineB) return null

        const flattenedInlines = this.flattenInlines(this.ast.blocks)
        const inlineIndexA = flattenedInlines.findIndex(i => i.id === inlineAId)
        const inlineIndexB = flattenedInlines.findIndex(i => i.id === inlineBId)
        if (inlineIndexA === -1 || inlineIndexB === -1) return null

        const [leftInline, rightInline] = inlineIndexA < inlineIndexB ? [inlineA, inlineB] : [inlineB, inlineA]

        const currentBlock = this.getBlockById(leftInline.blockId)
        if (!currentBlock) return null

        const mergedText = leftInline.text.symbolic + rightInline.text.symbolic
        const mergedInlines = parseInlineContent(mergedText, currentBlock.id, currentBlock.position.start)

        const leftInlineIndex = currentBlock.inlines.findIndex(i => i.id === leftInline.id)
        const rightInlineIndex = currentBlock.inlines.findIndex(
            i => i.id === rightInline.id
          )
          
        const deleteCount =
            rightInlineIndex === leftInlineIndex + 1 ? 2 : 1
          
        currentBlock.inlines.splice(leftInlineIndex, deleteCount, ...mergedInlines)

        const targetBlocks: Block[] = []
        targetBlocks.push(currentBlock)

        const previousBlock = this.getBlockById(rightInline.blockId)
        if (previousBlock && currentBlock.id !== previousBlock.id) {
            const rightInlineIndex = previousBlock.inlines.findIndex(i => i.id === rightInline.id)

            previousBlock.inlines.splice(rightInlineIndex, 1)
            previousBlock.text = previousBlock.inlines.map((i: Inline) => i.text.symbolic).join('')
            previousBlock.position = { start: previousBlock.position.start, end: previousBlock.position.end - rightInline.text.symbolic.length }
            
            targetBlocks.push(previousBlock)
        }

        currentBlock.text = mergedText
        currentBlock.position = { start: currentBlock.position.start, end: currentBlock.position.end - leftInline.text.symbolic.length + mergedText.length }

        return {
            render: {
                remove: [],
                insert: targetBlocks.map(block => ({
                    at: 'current',
                    target: block,
                    current: block,
                })),
            },
            caret: {
                blockId: currentBlock.id,
                inlineId: mergedInlines[0].id,
                position: leftInline.position.end,
                affinity: 'start'
            },
        }
    }

    public mergeMarker(blockId: string): AstApplyEffect | null {
        const block = this.getBlockById(blockId)
        if (!block) return null

        if (block.type === 'list') {
            const list = block
            const listIndex = this.ast.blocks.findIndex(b => b.id === list.id)
            const listItem = list.blocks[0] as ListItem

            const marker = listItem.text.match(/^[-*+]\s/)
            const listItemText = listItem.text.slice(marker?.[0]?.length ?? 0)
            const mergedText = marker?.[0]?.slice(0, -1) + listItemText

            const paragraph = {
                id: uuid(),
                type: 'paragraph',
                text: mergedText,
                inlines: [],
                position: { start: listItem.position.start, end: listItem.position.start + mergedText.length }
            } as Block

            const newInlines = parseInlineContent(mergedText, paragraph.id, paragraph.position.start)
            paragraph.inlines.push(...newInlines)

            if (list.blocks.length === 1) {
                this.ast.blocks.splice(listIndex, 1, paragraph)

                return {
                    render: {
                        remove: [list],
                        insert: [
                            {
                                at: 'current',
                                target: paragraph,
                                current: paragraph,
                            },
                        ],
                    },
                    caret: {
                        blockId: paragraph.id,
                        inlineId: paragraph.inlines[0].id,
                        position: 1,
                        affinity: 'start'
                    },
                }
            } else {
                list.blocks.splice(0, 1)
                this.ast.blocks.splice(listIndex, 1, paragraph)
                this.ast.blocks.splice(listIndex + 1, 0, list)

                return {
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
                    caret: {
                        blockId: paragraph.id,
                        inlineId: paragraph.inlines[0].id,
                        position: 1,
                        affinity: 'start'
                    },
                }
            }
        }

        return null
    }
}

export default AST
