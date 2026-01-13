import type { OpenBlock, Block, List } from '../../../types'
import { uuid } from '../../../utils/utils'

function getOpenParagraph(openBlocks: OpenBlock[]): Block | null {
    const last = openBlocks.at(-1)
    return last?.type === 'paragraph' ? last.block : null
}

function hasOpenBlockQuote(openBlocks: OpenBlock[]): boolean {
    return !!openBlocks.findLast(b => b.type === 'blockQuote')
}

function resolveBlankLine(openBlocks: OpenBlock[]) {
    while (openBlocks.at(-1)?.type === 'paragraph') openBlocks.pop()

    const list = openBlocks.findLast(b => b.type === 'list')
    if (list) (list.block as List).tight = false
}

function addParagraph(
    openBlocks: OpenBlock[],
    rootBlocks: Block[],
    text: string,
    offset: number
) {
    let parent = openBlocks.at(-1)?.block

    if (parent?.type === 'list') parent = undefined

    const p: Block = {
        id: uuid(),
        type: 'paragraph',
        text,
        position: { start: offset, end: offset + text.length },
        inlines: [],
    }

    if (parent && 'blocks' in parent) parent.blocks.push(p)
    else rootBlocks.push(p)

    openBlocks.push({ block: p, type: 'paragraph', indent: 0 })
}

export { getOpenParagraph, hasOpenBlockQuote, resolveBlankLine, addParagraph }
