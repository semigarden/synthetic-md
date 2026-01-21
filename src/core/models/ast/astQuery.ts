import { FlatBlockEntry, FlatInlineEntry, Block, Inline, List, ListItem, TaskListItem } from '../../types'
import Ast from './ast'

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

    public flattenBlocks(blocks: Block[], parent: Block | null = null, acc: FlatBlockEntry[] = []): FlatBlockEntry[] {
        blocks.forEach((block, index) => {
            acc.push({ block, parent, index })

            if ('blocks' in block && block.blocks) {
                this.flattenBlocks(block.blocks, block, acc)
            }
        })
    
        return acc
    }

    public flattenInlines(blocks: Block[], parent: Block | null = null, acc: FlatInlineEntry[] = []): FlatInlineEntry[] {
        for (const block of blocks) {
            block.inlines.forEach((inline, index) => {
                acc.push({ inline, block, index })
            })
    
            if ('blocks' in block && block.blocks) {
                this.flattenInlines(block.blocks, block, acc)
            }
        }
    
        return acc
    }

    public getParentBlock(block: Block): Block | null {
        const flattenedBlocks = this.flattenBlocks(this.blocks)
        const flatParentBlock = flattenedBlocks.find(b => 
            'blocks' in b.block && b.block.blocks?.some(child => child.id === block.id)
        )
        return flatParentBlock?.block ?? null
    }

    public getFirstInline(blocks: Block[]): Inline | null {
        for (const block of blocks) {
            if (block.inlines && block.inlines.length > 0) {
                const inline = block.inlines[0]
                if (block.type === 'listItem' || block.type === 'taskListItem' || block.type === 'blockQuote') {
                    if (inline.type !== 'marker') return inline
                } else {
                    return inline
                }
            }
    
            if ('blocks' in block && block.blocks.length > 0) {
                const found = this.getFirstInline(block.blocks)
                if (found) return found
            }
        }
        return null
    }

    public getLastInline(block: Block): Inline | null {
        if ('blocks' in block && block.blocks.length > 0) {
            for (let i = block.blocks.length - 1; i >= 0; i--) {
                const found = this.getLastInline(block.blocks[i])
                if (found) return found
            }
        }

        if (block.inlines && block.inlines.length > 0) {
            if (block.type === 'listItem' || block.type === 'taskListItem') {
                const contentInlines = block.inlines.filter(i => i.type !== 'marker')
                if (contentInlines.length > 0) {
                    return contentInlines[contentInlines.length - 1]
                }
            } else {
                return block.inlines[block.inlines.length - 1]
            }
        }
        
        return null
    }

    public getPreviousInline(inlineId: string): Inline | null {
        const flat = this.flattenInlines(this.blocks)
        const flatIndex = flat.findIndex(e => e.inline.id === inlineId)
        if (flatIndex === -1) return null
    
        return flatIndex > 0 ? flat[flatIndex - 1].inline : null
    }

    public getPreviousInlineInBlock(inline: Inline, block: Block): Inline | null {
        const inlineIndex = block.inlines.findIndex(i => i.id === inline.id)
        if (inlineIndex <= 0) return null
        return block.inlines[inlineIndex - 1]
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
    
            if (parent.type === 'listItem' || parent.type === 'taskListItem') {
                current = parent
                continue
            }
    
            if (parent.type === 'list' && parent.blocks[0]?.id === current.id) {
                return parent
            }
    
            return null
        }
    }

    public getListFromBlock(block: Block): List | null {
        let current: Block | null = block
        while (true) {
            const parent = this.getParentBlock(current)
            if (!parent) return null
            if (parent.type === 'list') return parent
            current = parent
        }
    }

    public getPreviousInlineInList(inline: Inline): Inline | null {
        const block = this.getBlockById(inline.blockId)
        if (!block) return null

        const list = this.getListFromBlock(block)
        if (!list) return null

        const flat = this.flattenInlines(list.blocks).filter(e => e.inline.type !== 'marker')
        const flatIndex = flat.findIndex(e => e.inline.id === inline.id)
        if (flatIndex === -1) return null
        return flatIndex > 0 ? flat[flatIndex - 1].inline : null
    }

    public getListItemText(item: ListItem, list: List): string {
        const index = list.blocks.findIndex(b => b.id === item.id)
        const marker = this.getListItemMarker(list, index)

        const text = item.blocks
            .map(b => b.inlines.map(i => i.text.symbolic).join(''))
            .join('')
    
        return marker + text
    }

    public getTaskListItemText(item: TaskListItem): string {
        const marker = this.getTaskListItemMarker(item)

        const text = item.blocks
            .map(b => b.inlines.map(i => i.text.symbolic).join(''))
            .join('')
    
        return marker + text
    }

    public getListItemMarker(list: List, index: number): string {
        if (!list.ordered) return '- '
      
        const start = list.listStart ?? 1
        return `${start + index}. `
    }

    public getTaskListItemMarker(taskListItem: TaskListItem): string {
        const checked = taskListItem.checked
        return `- [${checked ? 'x' : ' '}] `
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
            case 'taskListItem':
            case 'tableCell':
            case 'tableHeader':
            case 'blockQuote':
                return true
            default:
                return false
        }
    }

    public getBlockByPosition(position: number): Block | null {
        const flattenedBlocks = this.flattenBlocks(this.blocks)
        const flatBlock = flattenedBlocks.find(b => position >= b.block.position.start && position <= b.block.position.end)
        return flatBlock?.block ?? null
    }

    public prefixAsBlockQuote(text: string) {
        const lines = text.split('\n')
        return lines.map(l => `> ${l}`).join('\n')
    }
}

export default AstQuery
