import AST from "./ast"
import AstQuery from "./AstQuery"
import ParseAst from "../parse/parseAst"
import { Block, Inline, ListItem } from "../../types"
import { uuid } from "../../utils/utils"

class AstMutation {
    constructor(
        private ast: AST,
        private parser: ParseAst,
    ) {}

    private get query() {
        return new AstQuery(this.ast.blocks)
    }

    public splitBlockPure(
        block: Block,
        inlineId: string,
        caretPosition: number
    ): { left: Block; right: Block } | null {
        const inlineIndex = block.inlines.findIndex(i => i.id === inlineId)
        if (inlineIndex === -1) return null
    
        const inline = block.inlines[inlineIndex]
    
        const leftText = inline.text.symbolic.slice(0, caretPosition)
        const rightText = inline.text.symbolic.slice(caretPosition)
    
        const beforeInlines = block.inlines.slice(0, inlineIndex)
        const afterInlines = block.inlines.slice(inlineIndex + 1)
    
        const leftInlines = this.parser.inline.parseInlineContent(
            leftText,
            block.id,
            block.position.start
        )
    
        const rightBlockId = uuid()
    
        const rightInlines = this.parser.inline.parseInlineContent(
            rightText,
            rightBlockId,
            0
        ).concat(afterInlines)
    
        rightInlines.forEach((i: Inline) => (i.blockId = rightBlockId))
    
        const leftBlock: Block = {
            ...block,
            inlines: [...beforeInlines, ...leftInlines],
        }
    
        leftBlock.text = leftBlock.inlines.map(i => i.text.symbolic).join('')
        leftBlock.position = {
            start: block.position.start,
            end: block.position.start + leftBlock.text.length,
        }
    
        const rightBlock = {
            id: rightBlockId,
            type: block.type,
            inlines: rightInlines,
            text: rightInlines.map((i: Inline) => i.text.symbolic).join(''),
            position: {
                start: leftBlock.position.end,
                end: leftBlock.position.end +
                    rightInlines.map((i: Inline) => i.text.symbolic).join('').length,
            },
        } as Block
    
        return { left: leftBlock, right: rightBlock }
    }

    public mergeInlinePure(
        leftInline: Inline,
        rightInline: Inline
    ): {
        leftBlock: Block
        removedBlock?: Block
    } | null {
        const leftBlock = this.query.getBlockById(leftInline.blockId)
        const rightBlock = this.query.getBlockById(rightInline.blockId)
        if (!leftBlock || !rightBlock) return null
    
        const mergedText =
            leftInline.text.symbolic + rightInline.text.symbolic
    
        const mergedInlines = this.parser.inline.parseInlineContent(
            mergedText,
            leftBlock.id,
            leftBlock.position.start
        )
    
        const sameBlock = leftBlock.id === rightBlock.id
    
        if (sameBlock) {
            const leftIndex = leftBlock.inlines.findIndex(i => i.id === leftInline.id)
            const rightIndex = leftBlock.inlines.findIndex(i => i.id === rightInline.id)
            if (leftIndex === -1 || rightIndex === -1) return null
    
            leftBlock.inlines.splice(
                leftIndex,
                rightIndex === leftIndex + 1 ? 2 : 1,
                ...mergedInlines
            )
    
            leftBlock.text = leftBlock.inlines.map(i => i.text.symbolic).join('')
            leftBlock.position.end =
                leftBlock.position.start + leftBlock.text.length
    
            return { leftBlock }
        }

        const leftIndex = leftBlock.inlines.findIndex(i => i.id === leftInline.id)
        const rightIndex = rightBlock.inlines.findIndex(i => i.id === rightInline.id)
        if (leftIndex === -1 || rightIndex === -1) return null
    
        const tailInlines = rightBlock.inlines.slice(rightIndex + 1)
    
        tailInlines.forEach(i => (i.blockId = leftBlock.id))
    
        leftBlock.inlines.splice(
            leftIndex,
            1,
            ...mergedInlines,
            ...tailInlines
        )
    
        leftBlock.text = leftBlock.inlines.map(i => i.text.symbolic).join('')
        leftBlock.position.end =
            leftBlock.position.start + leftBlock.text.length
    
        return {
            leftBlock,
            removedBlock: rightBlock,
        }
    }

    public listItemToParagraph(listItem: ListItem): Block {
        const block = listItem.blocks[0]
    
        const paragraph: Block = {
            id: uuid(),
            type: 'paragraph',
            inlines: block.inlines,
            text: block.inlines.map(i => i.text.symbolic).join(''),
            position: { ...block.position },
        }

        paragraph.inlines.forEach(i => (i.blockId = paragraph.id))
    
        return paragraph
    }

    public removeBlockCascade(block: Block) {
        const removed: Block[] = []
        let current: Block | null = block
    
        while (current) {
            removed.push(current)
            const parent = this.query.getParentBlock(current)
    
            if (!parent) {
                const i = this.ast.blocks.findIndex(b => b.id === current!.id)
                if (i !== -1) this.ast.blocks.splice(i, 1)
                break
            }
    
            if ('blocks' in parent) {
                const i = parent.blocks.findIndex(b => b.id === current!.id)
                if (i !== -1) parent.blocks.splice(i, 1)
            }
    
            if (!this.isBlockEmpty(parent)) break

            current = parent
        }

        return removed
    }

    public isBlockEmpty(block: Block): boolean {
        if ('inlines' in block && block.inlines.length > 0) return false
        if ('blocks' in block && block.blocks.length > 0) return false
        return true
    }
}

export default AstMutation
