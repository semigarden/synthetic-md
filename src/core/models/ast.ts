import { buildAst, parseInlineContent } from '../ast/ast'
import {  Block, Document, Inline, ListItem } from '../types'
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

    private deleteEmptyBlock(block: Block) {
        if (block.inlines.length > 0) return
    
        const parentBlock = this.getParentBlock(block)
        if (!parentBlock) {
            const index = this.ast.blocks.findIndex(b => b.id === block.id)
            if (index !== -1) this.ast.blocks.splice(index, 1)
            return
        }
    
        if ('blocks' in parentBlock) {
            const index = parentBlock.blocks.findIndex(b => b.id === block.id)
            if (index !== -1) parentBlock.blocks.splice(index, 1)
        }
    
        this.deleteEmptyBlock(parentBlock)
    }

    public mergeInline(inlineAId: string, inlineBId: string): { targetBlocks: Block[], targetInline: Inline, targetPosition: number } | null {
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

        currentBlock.inlines.splice(leftInlineIndex, 1)
        currentBlock.inlines.splice(leftInlineIndex, 0, ...mergedInlines)

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
            targetBlocks: targetBlocks,
            targetInline: mergedInlines[0],
            targetPosition: leftInline.position.end,
        }
    }

    public mergeMarker(blockId: string) {
        const block = this.getBlockById(blockId)
        if (!block) return

        if (block.type === 'list') {
            const list = block
            const listIndex = this.ast.blocks.findIndex(b => b.id === list.id)
            const listItem = list.blocks[0] as ListItem

            if (list.blocks.length === 1) {
                // const listBlockEl = this.rootElement.querySelector(`[data-block-id="${list.id}"]`)
                // if (listBlockEl) {
                //     listBlockEl.remove()
                // }
 
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

                this.ast.blocks.splice(listIndex, 1, paragraph)

                console.log('mergedText', JSON.stringify(marker?.[0], null, 2), JSON.stringify(mergedText, null, 2))
                console.log('ast', JSON.stringify(this.ast, null, 2))

                return {
                    removeBlock: list,
                    targetBlock: paragraph,
                    targetInline: paragraph.inlines[0],
                    targetPosition: 1
                }
            } else {
                return {
                    removeBlock: list,
                    targetBlock: listItem.blocks[0],
                    targetInline: listItem.blocks[0].inlines[0],
                    targetPosition: 1
                }
            }
        }
    }
}

export default AST
