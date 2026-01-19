import type { AstApplyEffect, Block, DetectedBlock, TableCell, TableHeader, List } from '../../../types'
import type { AstContext } from '../astContext'

class AstTransform {
    constructor(private ctx: AstContext) {}

    transformBlock(
        text: string,
        block: Block,
        detected: DetectedBlock,
        caretPosition: number | null = null,
        removedBlocks: Block[] = [],
    ): AstApplyEffect | null {
        const { ast, query, parser, effect } = this.ctx

        text = text
            .replace(/[\u200B\u200C\u200D\uFEFF]/g, '')
            .replace(/\r$/, '')

        const flat = query.flattenBlocks(ast.blocks)
        const entry = flat.find(b => b.block.id === block.id)
        if (!entry) return null

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

        if (entry.parent && entry.parent.type === 'list' && block.type === 'listItem' && block.type !== detected.type) {
            const list = entry.parent as List
            const listEntry = flat.find(b => b.block.id === list.id)
            if (!listEntry) return null

            if (list.blocks.length > 1) {
                list.blocks.splice(entry.index, 1)
                ast.blocks.splice(listEntry.index, 0, ...newBlocks)

                return effect.compose(
                effect.update(
                    [{ at: 'previous', target: list, current: newBlocks[0] }],
                    [entry.block]
                ),
                effect.caret(inline.blockId, inline.id, caretPosition ?? inline.position.start, 'start')
                )
            } else {
                ast.blocks.splice(listEntry.index, 1, ...newBlocks)

                return effect.compose(
                    effect.update([{ at: 'current', target: list, current: newBlocks[0] }]),
                    effect.caret(inline.blockId, inline.id, caretPosition ?? inline.position.start, 'start')
                )
            }
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
