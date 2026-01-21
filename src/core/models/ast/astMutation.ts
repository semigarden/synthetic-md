import Ast from './ast'
import AstQuery from './astQuery'
import AstParser from '../parser/ast/astParser'
import { Block, Inline } from '../../types'
import { uuid } from '../../utils/utils'

class AstMutation {
    constructor(private ast: Ast, private parser: AstParser) {}

    private get query() {
        return new AstQuery(this.ast.blocks)
    }

    public splitBlockPure(block: Block, inlineId: string, caretPosition: number, options: { rightType?: Block['type']; leftType?: Block['type'] } = {}): { left: Block; right: Block } | null {
        const inlineIndex = block.inlines.findIndex(i => i.id === inlineId)
        if (inlineIndex === -1) return null
    
        const inline = block.inlines[inlineIndex]
    
        const leftText = inline.text.symbolic.slice(0, caretPosition)
        const rightText = inline.text.symbolic.slice(caretPosition)
    
        const beforeInlines = block.inlines.slice(0, inlineIndex)
        const afterInlines = block.inlines.slice(inlineIndex + 1)

        const leftType = options.leftType ?? block.type
        const rightType = options.rightType ?? block.type
    
        const leftInlines = this.parser.inline.parseInline(
            leftText,
            block.id,
            leftType,
            block.position.start
        )
    
        const rightBlockId = uuid()
    
        const rightInlines = this.parser.inline.parseInline(
            rightText,
            rightBlockId,
            rightType,
            0
        ).concat(afterInlines)
    
        rightInlines.forEach((i: Inline) => (i.blockId = rightBlockId))
    
        const leftBlock = {
            ...block,
            type: leftType,
            inlines: [...beforeInlines, ...leftInlines],
        } as Block
    
        leftBlock.text = leftBlock.inlines.map(i => i.text.symbolic).join('')
        leftBlock.position = {
            start: block.position.start,
            end: block.position.start + leftBlock.text.length,
        }
        if (leftBlock.text.trim() === '' && leftType !== 'blockQuote') {
            leftBlock.type = 'paragraph'
        }
    
        const rightBlock = {
            id: rightBlockId,
            type: rightType,
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
            let mergedText = leftInline.text.symbolic.slice(0, -1) + rightInline.text.symbolic

            if (leftOwner.type === 'blockQuote') {
                if (leftInline.type === 'marker') {
                    mergedText = rightInline.text.symbolic
    
                    return {
                        leftBlock: rightBlock,
                        mergedInline: rightInline,
                        removedBlock: leftBlock,
                    }
                }

                if (leftBlock.id !== rightBlock.id) {
                    const mergedText =
                    leftInline.text.symbolic +
                    rightInline.text.symbolic

                    const mergedInlines = this.parser.inline.parseInline(
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
                }
            }

            const mergedInlines = this.parser.inline.parseInline(
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

            const mergedInlines = this.parser.inline.parseInline(
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

        const mergedInlines = this.parser.inline.parseInline(
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
        switch (block.type) {
            case 'listItem':
            case 'taskListItem':
                return block.blocks.length === 0
    
            case 'list':
            case 'blockQuote':
                return block.blocks.length === 0
    
            case 'paragraph':
            case 'heading':
                return block.inlines.length === 0
    
            default:
                if ('blocks' in block && block.blocks.length > 0) return false
                if ('inlines' in block && block.inlines.length > 0) return false
                return true
        }
    }
}

export default AstMutation
