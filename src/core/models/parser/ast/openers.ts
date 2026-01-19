import type BlockParser from '../block/blockParser'
import { detectBlockType } from '../block/blockDetect'
import type { OpenBlock, Block, List, ListItem, TaskListItem } from '../../../types'
import { uuid } from '../../../utils/utils'

type AttachFn = (b: Block) => void

function tryOpenLeafBlock(
    blockParser: BlockParser,
    openBlocks: OpenBlock[],
    rootBlocks: Block[],
    line: string,
    offset: number
): boolean {
    const detected = detectBlockType(line)

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
    const indentMatch = /^(\s*)/.exec(line)
    const indent = indentMatch ? indentMatch[1].length : 0

    const info = parseListMarker(line)
    if (!info) return false

    while (openBlocks.at(-1)?.type === 'paragraph') openBlocks.pop()

    const ordered = info.ordered
    const listStart = info.kind === 'ol' ? info.listStart : undefined

    const markerLen = info.markerLen
    const content = line.slice(indent + markerLen)
    const listItemText = line.slice(0, indent + markerLen)

    while (true) {
        const top = openBlocks.at(-1)
        if (!top) break
    
        if (top.type === 'paragraph') {
            openBlocks.pop()
            continue
        }
    
        if (top.type === 'listItem' || top.type === 'taskListItem' && top.indent > indent) {
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

        const parentListItem = openBlocks.findLast(b => b.type === 'listItem' || b.type === 'taskListItem')?.block

        if (parentListItem && indent > (openListBlock?.indent ?? 0)) {
            (parentListItem as ListItem | TaskListItem).blocks.push(list)
        } else {
            rootBlocks.push(list)
        }

        openBlocks.push({ block: list, type: 'list', indent })
    }

    let item: ListItem | TaskListItem
    if (info.kind === 'task') {
        item = {
            id: uuid(),
            type: 'taskListItem',
            checked: info.checked,
            text: listItemText,
            blocks: [],
            position: { start: offset, end: offset },
            inlines: [],
        }
    } else {
        item = {
            id: uuid(),
            type: 'listItem',
            text: listItemText,
            blocks: [],
            position: { start: offset, end: offset },
            inlines: [],
        }
    }

    list.blocks.push(item)

    openBlocks.push({ block: item, type: item.type, indent: indent + markerLen })

    addParagraph(content, offset + indent + markerLen)
    return true
}

function parseListMarker(line: string) {
    const task = /^\s*([-*+])\s+\[([ xX])\](?:\s+|$)/.exec(line)
    if (task) {
        return {
            kind: 'task' as const,
            ordered: false,
            checked: task[2].toLowerCase() === 'x',
            markerLen: task[0].length,
        }
    }
  
    const ul = /^\s*([-*+])\s+/.exec(line)
    if (ul) {
        return { kind: 'ul' as const, ordered: false, markerLen: ul[0].length }
    }
  
    const ol = /^\s*(\d{1,9})([.)])\s+/.exec(line)
    if (ol) {
        return {
            kind: 'ol' as const,
            ordered: true,
            listStart: parseInt(ol[1], 10),
            markerLen: ol[0].length,
        }
    }
  
    return null
}

export { tryOpenLeafBlock, tryOpenBlockQuote, tryOpenList }
