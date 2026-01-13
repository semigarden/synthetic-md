import type BlockParser from '../blockParser'
import type { OpenBlock, Block, List, ListItem } from '../../../types'
import { uuid } from '../../../utils/utils'

type AttachFn = (b: Block) => void

function tryOpenLeafBlock(
    blockParser: BlockParser,
    openBlocks: OpenBlock[],
    rootBlocks: Block[],
    line: string,
    offset: number
): boolean {
    const detected = blockParser.detectType(line)

    const parent = openBlocks.at(-1)?.block
    const attach: AttachFn = (block: Block) => {
        if (parent && 'blocks' in parent) parent.blocks.push(block)
        else rootBlocks.push(block)
    }

    switch (detected.type) {
        case 'heading': {
            attach({
                id: uuid(),
                type: 'heading',
                level: detected.level!,
                text: line,
                position: { start: offset, end: offset + line.length },
                inlines: [],
            })
            return true
        }

        case 'thematicBreak': {
            attach({
                id: uuid(),
                type: 'thematicBreak',
                text: line,
                position: { start: offset, end: offset + line.length },
                inlines: [],
            })
            return true
        }

        case 'codeBlock': {
            const produced = blockParser.line(line, offset)
            if (produced) produced.forEach(attach)
            return true
        }

        case 'htmlBlock': {
            attach({
                id: uuid(),
                type: 'htmlBlock',
                text: line,
                position: { start: offset, end: offset + line.length },
                inlines: [],
            })
            return true
        }
    }

    return false
}

function tryOpenBlockQuote(
    parseLine: (line: string, offset: number) => void,
    openBlocks: OpenBlock[],
    rootBlocks: Block[],
    line: string,
    offset: number
): boolean {
    const match = /^(\s{0,3})>(?:\s?(.*))?$/.exec(line)
    if (!match) return false

    const indent = match[1].length
    const content = match[2] ?? ''
    const last = openBlocks.at(-1)

    if (last?.type === 'blockQuote') {
        parseLine(content, offset + indent + 1)
        return true
    }

    const blockQuote: Block = {
        id: uuid(),
        type: 'blockQuote',
        text: '',
        position: { start: offset, end: offset },
        blocks: [],
        inlines: [],
    }

    const parent = openBlocks.at(-1)?.block
    if (parent && 'blocks' in parent) parent.blocks.push(blockQuote)
    else rootBlocks.push(blockQuote)

    openBlocks.push({ block: blockQuote, type: 'blockQuote', indent })
    parseLine(content, offset + indent + 1)
    return true
}

function tryOpenList(
    openBlocks: OpenBlock[],
    rootBlocks: Block[],
    addParagraph: (text: string, offset: number) => void,
    line: string,
    offset: number
): boolean {
    const m = /^(\s*)([-*+]|(\d+[.)]))\s+(.*)$/.exec(line)
    if (!m) return false

    while (openBlocks.at(-1)?.type === 'paragraph') openBlocks.pop()

    const indent = m[1].length
    const marker = m[2]
    const ordered = !!m[3]
    const listStart = ordered ? parseInt(m[3], 10) : undefined
    const content = m[4]
    const listItemText = m[0]

    while (true) {
        const top = openBlocks.at(-1)
        if (!top) break

        if (top.type === 'paragraph') {
            openBlocks.pop()
            continue
        }

        if (top.type === 'listItem' && top.indent > indent) {
            if (indent > 0) break
            openBlocks.pop()
            continue
        }

        break
    }

    const openListBlock = openBlocks.findLast(
        b => b.type === 'list' && (b.block as List).ordered === ordered && b.indent === indent
    )

    let list = openListBlock?.block as List | undefined

    if (!list) {
        list = {
            id: uuid(),
            type: 'list',
            text: '',
            ordered,
            listStart,
            blocks: [],
            position: { start: offset, end: offset },
            inlines: [],
            tight: true,
        }

        const parentListItem = openBlocks.findLast(b => b.type === 'listItem')?.block

        if (parentListItem && indent > (openListBlock?.indent ?? 0)) {
            ;(parentListItem as ListItem).blocks.push(list)
        } else {
            rootBlocks.push(list)
        }

        openBlocks.push({ block: list, type: 'list', indent })
    }

    const item: ListItem = {
        id: uuid(),
        type: 'listItem',
        text: listItemText,
        blocks: [],
        position: { start: offset, end: offset },
        inlines: [],
    }

    list.blocks.push(item)
    openBlocks.push({ block: item, type: 'listItem', indent: indent + marker.length + 1 })

    addParagraph(content, offset + indent + marker.length + 1)
    return true
}

export { tryOpenLeafBlock, tryOpenBlockQuote, tryOpenList }
