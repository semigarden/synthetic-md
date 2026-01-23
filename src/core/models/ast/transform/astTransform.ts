import type { AstApplyEffect, Block, DetectedBlock, Inline, TableCell, TableHeader, List, ListItem, TaskListItem, BlockQuote } from '../../../types'
import type { AstContext } from '../astContext'

class AstTransform {
    constructor(private ctx: AstContext) {}

    private resolveCaret(inline: Inline, caretPosition: number | null) {
        if (caretPosition == null) {
            return { blockId: inline.blockId, inlineId: inline.id, pos: 0 }
        }

        const local = caretPosition - (inline.position?.start ?? 0)
        const pos = Math.max(0, Math.min(local, inline.text.symbolic.length))

        return { blockId: inline.blockId, inlineId: inline.id, pos: pos }
    }

    transformBlock(
        text: string,
        block: Block,
        detected: DetectedBlock,
        caretPosition: number | null = null,
        removedBlocks: Block[] = []
    ): AstApplyEffect | null {
        const { ast, query, parser, effect } = this.ctx

        text = text.replace(/[\u200B\u200C\u200D\uFEFF]/g, '').replace(/\r$/, '')

        const flat = query.flattenBlocks(ast.blocks)
        const entry = flat.find(b => b.block.id === block.id)
        if (!entry) return null

        if (block.type === 'codeBlock' && detected.type === 'paragraph') {
            const newBlocks = parser.reparseTextFragment(text, block.position.start)
            const inline = query.getFirstInline(newBlocks)
            if (!inline) return null

            const { blockId, inlineId, pos } = this.resolveCaret(inline, caretPosition)

            if (entry.parent && (entry.parent.type === 'tableCell' || entry.parent.type === 'tableHeader')) {
                const cell = entry.parent as TableCell | TableHeader
                cell.blocks.splice(entry.index, 1, ...newBlocks)

                return effect.compose(
                    effect.update([{ at: 'current', target: cell, current: cell }], removedBlocks),
                    effect.caret(blockId, inlineId, pos, 'start')
                )
            }

            if (entry.parent && 'blocks' in entry.parent && Array.isArray((entry.parent as any).blocks)) {
                const parent = entry.parent as any
                parent.blocks.splice(entry.index, 1, ...newBlocks)

                return effect.compose(
                    effect.update([{ at: 'current', target: parent, current: parent }], removedBlocks),
                    effect.caret(blockId, inlineId, pos, 'start')
                )
            }

            const oldBlock = block
            ast.blocks.splice(entry.index, 1, ...newBlocks)

            const effects: AstApplyEffect['renderEffect']['render']['insert'] = []

            newBlocks.forEach((b, idx) => {
                effects.push({ at: idx === 0 ? 'current' as const : 'next' as const, target: idx === 0 ? oldBlock : newBlocks[idx - 1], current: b })
            })

            return effect.compose(effect.update(effects, removedBlocks), effect.caret(blockId, inlineId, pos, 'start'))
        }

        if (
            block.type === 'paragraph' &&
            entry.parent &&
            (entry.parent.type === 'listItem' || entry.parent.type === 'taskListItem')
        ) {
            const parent = entry.parent as ListItem | TaskListItem
            const marker = parent.inlines?.find((i: Inline) => i.type === 'marker')?.text.symbolic ?? ''

            if (/^(\s*[-*+]\s+|\s*\d+[.)]\s+)$/.test(marker)) {
                const m = /^\[([ xX])\](?:\s+|$)/.exec(text)
                if (m) {
                    const checked = m[1].toLowerCase() === 'x'
                    ;(parent as any).type = 'taskListItem'
                    ;(parent as any).checked = checked
                    text = text.slice(m[0].length)
                } else if (parent.type === 'taskListItem') {
                    ;(parent as any).type = 'listItem'
                    delete (parent as any).checked
                }
            }
        }

        const newBlocks = parser.reparseTextFragment(text, block.position.start)
        const inline = query.getFirstInline(newBlocks)
        if (!inline) return null

        if (entry.parent && (entry.parent.type === 'tableCell' || entry.parent.type === 'tableHeader')) {
            const cell = entry.parent as TableCell | TableHeader
            cell.blocks.splice(entry.index, 1, ...newBlocks)

            return effect.compose(
                effect.update([{ at: 'current', target: cell, current: cell }]),
                effect.caret(inline.blockId, inline.id, caretPosition ?? inline.position.start, 'start')
            )
        }

        const isListItemBlock = block.type === 'listItem' || block.type === 'taskListItem'
        const isListItemDetected = detected.type === 'listItem' || detected.type === 'taskListItem'

        if (entry.parent && entry.parent.type === 'list' && isListItemBlock && !isListItemDetected) {
            const list = entry.parent as List
            const listEntry = flat.find(b => b.block.id === list.id)
            if (!listEntry) return null

            if (list.blocks.length > 1) {
                list.blocks.splice(entry.index, 1)
                ast.blocks.splice(listEntry.index, 0, ...newBlocks)

                return effect.compose(
                    effect.update([{ at: 'previous', target: list, current: newBlocks[0] }], [entry.block]),
                    effect.caret(inline.blockId, inline.id, caretPosition ?? inline.position.start, 'start')
                )
            }

            ast.blocks.splice(listEntry.index, 1, ...newBlocks)

            return effect.compose(
                effect.update([{ at: 'current', target: list, current: newBlocks[0] }]),
                effect.caret(inline.blockId, inline.id, caretPosition ?? inline.position.start, 'start')
            )
        }

        if (entry.parent && 'blocks' in entry.parent && Array.isArray((entry.parent as any).blocks)) {
            const parent = entry.parent as any
            parent.blocks.splice(entry.index, 1, ...newBlocks)

            return effect.compose(
                effect.update([{ at: 'current', target: parent, current: parent }], removedBlocks),
                effect.caret(inline.blockId, inline.id, caretPosition ?? inline.position.start, 'start')
            )
        }

        const oldBlock = block
        ast.blocks.splice(entry.index, 1, ...newBlocks)

        return effect.compose(
            effect.update([{ at: 'current', target: oldBlock, current: newBlocks[0] }], removedBlocks),
            effect.caret(inline.blockId, inline.id, caretPosition ?? inline.position.start, 'start')
        )
    }
}

export default AstTransform
