import { FlatEntry, Block, Inline, List, ListItem } from "../../types"

class AstQuery {
    constructor(private blocks: Block[]) {}

    public getBlockById(targetId: string, blocks: Block[] = this.blocks): Block | null {
        for (const block of blocks) {
            if (block.id === targetId) {
                return block
            }
            if ('blocks' in block && block.blocks) {
                const found = this.getBlockById(targetId, block.blocks)
                if (found) return found
            }
        }
        return null
    }

    public getInlineById(targetId: string, blocks: Block[] = this.blocks): Inline | null {
        for (const block of blocks) {
            for (const inline of block.inlines) {
                if (inline.id === targetId) {
                    return inline
                }
            }

            if ('blocks' in block && block.blocks) {
                const found = this.getInlineById(targetId, block.blocks)
                if (found) return found
            }
        }
        return null
    }

    public flattenBlocks(blocks: Block[], parent: Block | null = null, acc: FlatEntry[] = []): FlatEntry[] {
        blocks.forEach((block, index) => {
            acc.push({ block, parent, index })

            if ('blocks' in block && block.blocks) {
                this.flattenBlocks(block.blocks, block, acc)
            }
        })
    
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

    public getParentBlock(block: Block): Block | null {
        const flattenedBlocks = this.flattenBlocks(this.blocks)
        const flatParentBlock = flattenedBlocks.find(b => b.block.type === 'list' && b.block.blocks?.some(b => b.id === block.id)) ?? flattenedBlocks.find(b => b.block.type === 'listItem' && b.block.blocks?.some(b => b.id === block.id))
        return flatParentBlock?.block ?? null
    }

    public getFirstInline(blocks: Block[]): Inline | null {
        for (const block of blocks) {
            if (block.inlines && block.inlines.length > 0) {
                const inline = block.inlines[0]
                return inline
            }
    
            if ('blocks' in block && block.blocks.length > 0) {
                const found = this.getFirstInline(block.blocks)
                if (found) return found
            }
        }
        return null
    }

    public getPreviousInline(inlineId: string): Inline | null {
        const flattenedInlines = this.flattenInlines(this.blocks)
        const inlineIndex = flattenedInlines.findIndex(i => i.id === inlineId)
        if (inlineIndex === -1) return null

        return flattenedInlines[inlineIndex - 1] ?? null
    }

    public getInlineAtPosition(inlines: Inline[], caretPosition: number): { inline: Inline; position: number } | null {
        let acc = 0
    
        for (const inline of inlines) {
            const len = inline.text.symbolic.length
    
            if (caretPosition <= acc + len) {
                return {
                    inline,
                    position: Math.max(0, caretPosition - acc),
                }
            }
    
            acc += len
        }

        const last = inlines.at(-1)
        if (!last) return null

        return {
            inline: last,
            position: last.text.symbolic.length,
        }
    }

    public getListForMarkerMerge(block: Block): List | null {
        let current: Block | null = block
    
        while (true) {
            const parent = this.getParentBlock(current)
            if (!parent) return null
    
            if (parent.type === 'listItem') {
                current = parent
                continue
            }
    
            if (parent.type === 'list' && parent.blocks[0]?.id === current.id) {
                return parent
            }
    
            return null
        }
    }

    public getListItemText(item: ListItem): string {
        const marker = '- '
        return marker + item.blocks
            .map(b => b.inlines.map(i => i.text.symbolic).join(''))
            .join('')
    }

    public getInlineMergeOwner(inline: Inline): Block | null {
        let block = this.getBlockById(inline.blockId)
        if (!block) return null

        while (block) {
            if (this.isInlineMergeBoundary(block)) {
            return block
            }

            block = this.getParentBlock(block)
        }

        return null
    }

    public getInlinesUnder(blockId: string): Inline[] {
        const block = this.getBlockById(blockId)
        if (!block) return []
    
        const inlines: Inline[] = []
    
        const collect = (block: Block) => {
            inlines.push(...block.inlines)
            if ('blocks' in block && block.blocks) {
                for (const child of block.blocks) {
                    collect(child)
                }
            }
        }
    
        collect(block)
        return inlines
    }    

    private isInlineMergeBoundary(block: Block): boolean {
        switch (block.type) {
            case 'listItem':
            case 'tableCell':
                return true
            default:
                return false
        }
    }
}

export default AstQuery
