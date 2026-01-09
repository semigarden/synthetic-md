import AST from "./ast"
import AstQuery from "./AstQuery"
import ParseAst from "../parse/parseAst"
import { Block, Inline, ListItem } from "../../types"
import { uuid } from "../../utils/utils"

class AstMutation {
    constructor(private ast: AST, private parser: ParseAst) {}

    private get query() {
        return new AstQuery(this.ast.blocks)
    }

    public splitBlockPure(block: Block, inlineId: string, caretPosition: number): { left: Block; right: Block } | null {
        const inlineIndex = block.inlines.findIndex(i => i.id === inlineId)
        if (inlineIndex === -1) return null
    
        const inline = block.inlines[inlineIndex]
    
        const leftText = inline.text.symbolic.slice(0, caretPosition)
        const rightText = inline.text.symbolic.slice(caretPosition)
    
        const beforeInlines = block.inlines.slice(0, inlineIndex)
        const afterInlines = block.inlines.slice(inlineIndex + 1)
    
        const leftInlines = this.parser.inline.lexInline(
            leftText,
            block.id,
            block.type,
            block.position.start
        )
    
        const rightBlockId = uuid()
    
        const rightInlines = this.parser.inline.lexInline(
            rightText,
            rightBlockId,
            block.type,
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

    public mergeInlinePure(leftInline: Inline, rightInline: Inline): { leftBlock: Block; mergedInline: Inline; removedBlock?: Block } | null {
        const leftBlock = this.query.getBlockById(leftInline.blockId)
        const rightBlock = this.query.getBlockById(rightInline.blockId)
        if (!leftBlock || !rightBlock) return null
    
        const leftOwner = this.query.getInlineMergeOwner(leftInline)
        const rightOwner = this.query.getInlineMergeOwner(rightInline)
        const sameOwner = leftOwner && rightOwner && leftOwner.id === rightOwner.id

        if (sameOwner && leftOwner) {
            const owner = leftOwner
        
            const ownerText = this.ast.query.getInlinesUnder(owner.id)
                .map(i => i.text.symbolic)
                .join('')
        
            const mergedText =
                ownerText.slice(0, ownerText.length - rightInline.text.symbolic.length - 1) +
                rightInline.text.symbolic
        
            const mergedInlines = this.parser.inline.lexInline(
                mergedText,
                owner.id,
                owner.type,
                owner.position.start
            )
        
            this.clearInlinesUnder(owner.id)
        
            owner.inlines = mergedInlines
            owner.text = mergedText
            owner.position.end = owner.position.start + mergedText.length

            return {
                leftBlock: owner,
                mergedInline: mergedInlines[0],
            }
        }

        if (leftBlock.id === rightBlock.id) {
            const mergedText =
                leftInline.text.symbolic.slice(0, -1) +
                rightInline.text.symbolic

            const mergedInlines = this.parser.inline.lexInline(
                mergedText,
                leftBlock.id,
                leftBlock.type,
                leftBlock.position.start
            )

            leftBlock.inlines = mergedInlines
            leftBlock.text = mergedText
            leftBlock.position.end =
            leftBlock.position.start + mergedText.length

            return { leftBlock, mergedInline: mergedInlines[0] }
        }

        const mergedText =
        leftInline.text.symbolic +
        rightInline.text.symbolic

        const mergedInlines = this.parser.inline.lexInline(
            mergedText,
            leftBlock.id,
            leftBlock.type,
            leftBlock.position.start
        )

        const rightIndex = rightBlock.inlines.findIndex(i => i.id === rightInline.id)

        const tailInlines = rightBlock.inlines.slice(rightIndex + 1)
        tailInlines.forEach(i => (i.blockId = leftBlock.id))

        leftBlock.inlines = [
        ...leftBlock.inlines.slice(0, -1),
        ...mergedInlines,
        ...tailInlines,
        ]

        leftBlock.text = leftBlock.inlines.map(i => i.text.symbolic).join('')
        leftBlock.position.end =
        leftBlock.position.start + leftBlock.text.length

        return {
            leftBlock,
            mergedInline: mergedInlines[0],
            removedBlock: rightBlock,
        }

        // console.log('sameBlock', sameBlock)
        // console.log('leftInline', JSON.stringify(leftInline, null, 2))
        // console.log('rightInline', JSON.stringify(rightInline, null, 2))
        // if (sameBlock) {
        //     const mergedText = leftInline.text.symbolic.slice(0, -1) + rightInline.text.symbolic
        //     const mergedInlines = this.parser.inline.lexInline(
        //         mergedText,
        //         leftBlock.id,
        //         leftBlock.type,
        //         leftBlock.position.start
        //     )

        //     const leftIndex = leftBlock.inlines.findIndex(i => i.id === leftInline.id)
        //     const rightIndex = leftBlock.inlines.findIndex(i => i.id === rightInline.id)
        //     if (leftIndex === -1 || rightIndex === -1) return null
    
        //     leftBlock.inlines.splice(
        //         leftIndex,
        //         rightIndex === leftIndex + 1 ? 2 : 1,
        //         ...mergedInlines
        //     )
    
        //     leftBlock.text = leftBlock.inlines.map(i => i.text.symbolic).join('')
        //     leftBlock.position.end =
        //         leftBlock.position.start + leftBlock.text.length
    
        //     return { leftBlock, mergedInline: mergedInlines[0] }
        // }

        // const mergedText = leftInline.text.symbolic + rightInline.text.symbolic
        // const mergedInlines = this.parser.inline.lexInline(
        //     mergedText,
        //     leftBlock.id,
        //     leftBlock.type,
        //     leftBlock.position.start
        // )

        // console.log('mergedInlines', JSON.stringify(mergedInlines, null, 2))
        // console.log('mergedText', JSON.stringify(mergedText, null, 2))

        // const leftIndex = leftBlock.inlines.findIndex(i => i.id === leftInline.id)
        // const rightIndex = rightBlock.inlines.findIndex(i => i.id === rightInline.id)
        // if (leftIndex === -1 || rightIndex === -1) return null
    
        // const tailInlines = rightBlock.inlines.slice(rightIndex + 1)
    
        // tailInlines.forEach(i => (i.blockId = leftBlock.id))
    
        // leftBlock.inlines.splice(
        //     leftIndex,
        //     1,
        //     ...mergedInlines,
        //     ...tailInlines
        // )

        // leftBlock.text = leftBlock.inlines.map(i => i.text.symbolic).join('')
        // leftBlock.position.end =
        //     leftBlock.position.start + leftBlock.text.length
    
        // return {
        //     leftBlock,
        //     mergedInline: mergedInlines[0],
        //     removedBlock: rightBlock,
        // }
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

    public clearInlinesUnder(ownerId: string): void {
        const owner = this.query.getBlockById(ownerId)
        if (!owner) return

        const clear = (block: Block) => {
            block.inlines = []

            if ('blocks' in block && block.blocks) {
                for (const child of block.blocks) {
                    clear(child)
                }
            }
        }

        clear(owner)
    }

    public isBlockEmpty(block: Block): boolean {
        if ('inlines' in block && block.inlines.length > 0) return false
        if ('blocks' in block && block.blocks.length > 0) return false
        return true
    }
}

export default AstMutation
