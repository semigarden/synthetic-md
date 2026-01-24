import { detectBlockType } from '../blockDetect'
import { uuid } from '../../../../utils/utils'
import type { Block, Table, TableRow, TableCell, TableHeader, DetectedBlock } from '../../../../types'

function isTableDivider(line: string): boolean {
    return /^\s*\|?\s*[-:]+(?:\s*\|\s*[-:]+)*\s*\|?\s*$/.test(line)
}

function splitRow(line: string): string[] {
    return line
        .trim()
        .replace(/^\||\|$/g, '')
        .split('|')
        .map(c => c.trim())
}

function buildTableBlock(context: {
    start: number
    headerLine: string
    dividerLine?: string
    rows: string[]
}): Table {
    const makeBlock = (text: string): Block => {
        const trimmed = text.trim()
        const detected: DetectedBlock = detectBlockType(trimmed)

        if (detected.type === 'heading' && 'level' in detected && detected.level !== undefined) {
            return {
                id: uuid(),
                type: 'heading',
                text: trimmed,
                level: detected.level,
                position: { start: 0, end: trimmed.length },
                inlines: [],
            }
        }

        if (detected.type === 'listItem') {
            const listItem: Block = {
                id: uuid(),
                type: 'listItem',
                text: trimmed,
                position: { start: 0, end: trimmed.length },
                blocks: [
                    {
                        id: uuid(),
                        type: 'paragraph',
                        text: trimmed.replace(/^\s*[-*+]\s+|\s*\d+[.)]\s+/, ''),
                        position: { start: 0, end: trimmed.length },
                        inlines: [],
                    },
                ],
                inlines: [],
            }

            return {
                id: uuid(),
                type: 'list',
                text: trimmed,
                ordered: 'ordered' in detected && (detected as any).ordered === true,
                listStart: 'listStart' in detected ? (detected as any).listStart : 1,
                tight: true,
                position: { start: 0, end: trimmed.length },
                blocks: [listItem],
                inlines: [],
            }
        }
        
        if (detected.type === 'taskListItem') {}

        if (detected.type === 'codeBlock') {
            return {
                id: uuid(),
                type: 'codeBlock',
                text: trimmed,
                isFenced: trimmed.startsWith('```') || trimmed.startsWith('~~~'),
                language: '',
                position: { start: 0, end: trimmed.length },
                inlines: [],
            }
        }

        if (detected.type === 'thematicBreak') {
            return {
                id: uuid(),
                type: 'thematicBreak',
                text: trimmed,
                position: { start: 0, end: trimmed.length },
                inlines: [],
            }
        }

        if (detected.type === 'blockQuote') {
            return {
                id: uuid(),
                type: 'blockQuote',
                text: trimmed,
                position: { start: 0, end: trimmed.length },
                blocks: [
                    {
                        id: uuid(),
                        type: 'paragraph',
                        text: trimmed.replace(/^\s*>\s*/, ''),
                        position: { start: 0, end: trimmed.length },
                        inlines: [],
                    },
                ],
                inlines: [],
            }
        }

        return {
            id: uuid(),
            type: 'paragraph',
            text: trimmed,
            position: { start: 0, end: trimmed.length },
            inlines: [],
        }
    }

    const makeCell = (text: string, isHeader = false): TableCell | TableHeader => {
        const parts = text.split(/<br\s*\/?>/i)
        const blocks: Block[] = parts.map(makeBlock)

        if (isHeader) {
            return {
                id: uuid(),
                type: 'tableHeader',
                text,
                position: { start: 0, end: text.length },
                blocks,
                inlines: [],
            }
        }

        return {
            id: uuid(),
            type: 'tableCell',
            text,
            position: { start: 0, end: text.length },
            blocks,
            inlines: [],
        }
    }

    const makeRow = (line: string, isHeader = false): TableRow => {
        const cells = splitRow(line).map(cellText => makeCell(cellText, isHeader))
        return {
            id: uuid(),
            type: 'tableRow',
            text: line,
            position: { start: 0, end: line.length },
            blocks: cells,
            inlines: [],
        }
    }

    const header = makeRow(context.headerLine, true)
    const rows = context.rows.map(line => makeRow(line, false))

    return {
        id: uuid(),
        type: 'table',
        text: '',
        position: { start: context.start, end: context.start + context.headerLine.length },
        blocks: [header, ...rows],
        inlines: [],
    }
}

export { isTableDivider, splitRow, buildTableBlock }
