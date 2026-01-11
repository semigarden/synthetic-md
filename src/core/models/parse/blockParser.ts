import { ParseBlockContext, DetectedBlock, Block, Table, TableRow, TableCell, TableHeader } from "../../types"
import { uuid } from "../../utils/utils"

class BlockParser {
    private context: ParseBlockContext

    constructor() {
        this.context = {
            isFencedCodeBlock: false,
            codeBlockFence: '',
            currentCodeBlock: null,
        }
    }

    public flush(offset: number): Block[] | null {
        if (this.context.table) {
            const table = this.context.table
            this.context.table = undefined

            if (table.dividerLine) {
                return [this.buildTableBlock(table)]
            }

            const paragraph: Block = {
                id: uuid(),
                type: 'paragraph',
                text: table.headerLine,
                position: { start: table.start, end: table.start + table.headerLine.length },
                inlines: [],
            }
            return [paragraph]
        }
        return null
    }

    public line(line: string, offset: number): Block[] | null {
        const blocks: Block[] = []

        const start = offset
        const end = offset + line.length

        const {
            isFencedCodeBlock,
            codeBlockFence,
            currentCodeBlock,
        } = this.context

        if (isFencedCodeBlock && currentCodeBlock) {
            const closeMatch = line.match(
                new RegExp(`^\\s{0,3}${codeBlockFence.charAt(0)}{${codeBlockFence.length},}\\s*$`)
            )

            currentCodeBlock.text += '\n' + line
            currentCodeBlock.position.end = end + 1

            if (closeMatch) {
                this.context.isFencedCodeBlock = false
                this.context.codeBlockFence = ''
                this.context.currentCodeBlock = null
            }

            return null
        }

        if (this.context.table) {
            const table = this.context.table
        
            if (!table.dividerLine) {
                if (this.isTableDivider(line)) {
                    table.dividerLine = line
                    return null
                }

                this.context.table = undefined
                const paragraph: Block = {
                    id: uuid(),
                    type: 'paragraph',
                    text: table.headerLine,
                    position: { start: table.start, end: table.start + table.headerLine.length },
                    inlines: [],
                }
                const currentLineBlocks = this.line(line, start) ?? []
                return [paragraph, ...currentLineBlocks]
            }
        
            if (/\|/.test(line)) {
                table.rows.push(line)
                return null
            }
        
            const block = this.buildTableBlock(table)
            this.context.table = undefined
        
            return [block, ...(this.line(line, offset) ?? [])]
        }

        const trimmed = line.trim()
        if (/\|/.test(trimmed) && !this.isTableDivider(line)) {
            this.context.table = {
                start,
                headerLine: line,
                rows: []
            }
            return null
        }

        const detected = this.detectType(line)
        let block: Block

        switch (detected.type) {
            case 'heading': {
                block = {
                    id: uuid(),
                    type: 'heading',
                    level: detected.level!,
                    text: line,
                    position: { start, end },
                    inlines: [],
                }
                blocks.push(block)
                break
            }

            case 'blockQuote': {
                const match = line.match(/^(\s{0,3}> ?)(.*)$/)

                const marker = match ? match[1] : '>'
                const content = match ? match[2] : ''

                const innerBlocks = this.line(content, start + marker.length) ?? []

                block = {
                    id: uuid(),
                    type: 'blockQuote',
                    text: line,
                    position: { start, end },
                    blocks: innerBlocks,
                    inlines: [],
                }

                blocks.push(block)
                break
            }

            case 'listItem': {
                const markerMatch = /^(\s*([-*+]|(\d+[.)])))\s+/.exec(line)
                const markerLength = markerMatch ? markerMatch[0].length : 0
                const listItemText = line.slice(markerLength)

                const paragraph: Block = {
                    id: uuid(),
                    type: 'paragraph',
                    text: listItemText,
                    position: { start: start + markerLength, end },
                    inlines: [],
                }

                const listItem: Block = {
                    id: uuid(),
                    type: 'listItem',
                    text: markerMatch
                        ? markerMatch[0] + listItemText
                        : listItemText,
                    position: { start, end },
                    blocks: [paragraph],
                    inlines: [],
                }

                const last = blocks[blocks.length - 1]
                if (
                    last &&
                    last.type === 'list' &&
                    (last as any).ordered === !!detected.ordered
                ) {
                    ;(last as any).blocks.push(listItem)
                    last.position.end = end
                } else {
                    const list: Block = {
                        id: uuid(),
                        type: 'list',
                        text: '',
                        position: { start, end },
                        ordered: !!detected.ordered,
                        listStart: detected.listStart,
                        tight: true,
                        blocks: [listItem],
                        inlines: [],
                    }
                    blocks.push(list)
                }
                break
            }

            case 'codeBlock': {
                const fenceMatch = line.match(/^(\s{0,3})(```+|~~~+)(.*)$/)

                if (fenceMatch) {
                    block = {
                        id: uuid(),
                        type: 'codeBlock',
                        text: line,
                        language: fenceMatch[3].trim() || undefined,
                        isFenced: true,
                        fence: fenceMatch[2],
                        position: { start, end },
                        inlines: [],
                    }

                    blocks.push(block)

                    this.context.isFencedCodeBlock = true
                    this.context.codeBlockFence = fenceMatch[2]
                    this.context.currentCodeBlock = block
                } else {
                    block = {
                        id: uuid(),
                        type: 'codeBlock',
                        text: line.replace(/^ {4}/, ''),
                        isFenced: false,
                        position: { start, end },
                        inlines: [],
                    }
                    blocks.push(block)
                }
                break
            }

            case 'thematicBreak': {
                block = {
                    id: uuid(),
                    type: 'thematicBreak',
                    text: line,
                    position: { start, end },
                    inlines: [],
                }
                blocks.push(block)
                break
            }

            case 'paragraph':
            default: {
                block = {
                    id: uuid(),
                    type: 'paragraph',
                    text: line,
                    position: { start, end },
                    inlines: [],
                }
                blocks.push(block)
                break
            }
        }

        return blocks
    }

    public detectType(line: string): DetectedBlock {
        const trimmed = line.trim()
    
        if (trimmed === "") return { type: "blankLine" }
    
        const headingMatch = trimmed.match(/^(#{1,6})(?:\s+(.*))?$/)
        if (headingMatch) {
            return { type: 'heading', level: headingMatch[1].length }
        }
    
        if (/^>/.test(line)) {
            return { type: 'blockQuote' }
        }
    
        if (/^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
            return { type: 'thematicBreak' }
        }
    
        if (/^\s{0,3}(```+|~~~+)/.test(line)) {
            return { type: 'codeBlock' }
        }
    
        const taskListMatch = /^\s*([-*+])\s+\[([ xX])\]\s+/.exec(line)
        if (taskListMatch) {
            return { 
                type: 'taskListItem', 
                ordered: false,
                checked: taskListMatch[2].toLowerCase() === 'x'
            }
        }
    
        const unorderedListMatch = /^\s*([-*+])\s+/.exec(line)
        if (unorderedListMatch) {
            return { type: 'listItem', ordered: false }
        }
    
        const orderedListMatch = /^\s*(\d{1,9})([.)])\s+/.exec(line)
        if (orderedListMatch) {
            return { 
                type: 'listItem', 
                ordered: true,
                listStart: parseInt(orderedListMatch[1], 10)
            }
        }
    
        if (/^ {4,}[^ ]/.test(line)) {
            return { type: 'codeBlock' }
        }
    
        if (/^\[\^[^\]]+\]:/.test(trimmed)) {
            return { type: 'footnote' }
        }
    
        if (/^\s{0,3}<(?:script|pre|style|textarea)[\s>]/i.test(line) ||
            /^\s{0,3}<!--/.test(line) ||
            /^\s{0,3}<\?/.test(line) ||
            /^\s{0,3}<![A-Z]/.test(line) ||
            /^\s{0,3}<!\[CDATA\[/.test(line) ||
            /^\s{0,3}<\/?(?:address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h1|h2|h3|h4|h5|h6|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)(?:\s|\/?>|$)/i.test(line)) {
            return { type: 'htmlBlock' }
        }
    
        if (/^\s{0,3}\[([^\]]+)\]:\s*/.test(line)) {
            return { type: 'paragraph' }
        }
    
        return { type: 'paragraph' }
    }

    public reset() {
        this.context = {
            isFencedCodeBlock: false,
            codeBlockFence: '',
            currentCodeBlock: null,
            table: undefined,
        }
    }

    public get hasPendingTable(): boolean {
        return !!this.context.table
    }

    private isTableDivider(line: string): boolean {
        return /^\s*\|?\s*[-:]+(?:\s*\|\s*[-:]+)*\s*\|?\s*$/.test(line)
    }
    
    private splitRow(line: string): string[] {
        return line
            .trim()
            .replace(/^\||\|$/g, '')
            .split('|')
            .map(c => c.trim())
    }

    private buildTableBlock(context: {start: number; headerLine: string; dividerLine?: string; rows: string[]}): Table {
        const makeBlock = (text: string): Block => {
            const trimmed = text.trim()
            const detected = this.detectType(trimmed)
            
            if (detected.type === 'heading' && 'level' in detected && detected.level !== undefined) {
                return {
                    id: uuid(),
                    type: 'heading' as const,
                    text: trimmed,
                    level: detected.level,
                    position: { start: 0, end: trimmed.length },
                    inlines: [],
                }
            }
            
            if (detected.type === 'listItem') {
                const listItem = {
                    id: uuid(),
                    type: 'listItem' as const,
                    text: trimmed,
                    position: { start: 0, end: trimmed.length },
                    blocks: [{
                        id: uuid(),
                        type: 'paragraph' as const,
                        text: trimmed.replace(/^\s*[-*+]\s+|\s*\d+[.)]\s+/, ''),
                        position: { start: 0, end: trimmed.length },
                        inlines: [],
                    }],
                    inlines: [],
                }
                
                return {
                    id: uuid(),
                    type: 'list' as const,
                    text: trimmed,
                    ordered: 'ordered' in detected && detected.ordered === true,
                    listStart: 'listStart' in detected ? detected.listStart : 1,
                    tight: true,
                    position: { start: 0, end: trimmed.length },
                    blocks: [listItem],
                    inlines: [],
                }
            }
            
            if (detected.type === 'codeBlock') {
                return {
                    id: uuid(),
                    type: 'codeBlock' as const,
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
                    type: 'thematicBreak' as const,
                    text: trimmed,
                    position: { start: 0, end: trimmed.length },
                    inlines: [],
                }
            }
            
            if (detected.type === 'blockQuote') {
                return {
                    id: uuid(),
                    type: 'blockQuote' as const,
                    text: trimmed,
                    position: { start: 0, end: trimmed.length },
                    blocks: [{
                        id: uuid(),
                        type: 'paragraph' as const,
                        text: trimmed.replace(/^\s*>\s*/, ''),
                        position: { start: 0, end: trimmed.length },
                        inlines: [],
                    }],
                    inlines: [],
                }
            }
            
            return {
                id: uuid(),
                type: 'paragraph' as const,
                text: trimmed,
                position: { start: 0, end: trimmed.length },
                inlines: [],
            }
        }

        const makeCell = (text: string, isHeader: boolean = false): TableCell | TableHeader => {
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
    
        const makeRow = (line: string, isHeader: boolean = false): TableRow => {
            const cells = this.splitRow(line).map(cellText => makeCell(cellText, isHeader))
    
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
            position: {
                start: context.start,
                end: context.start + context.headerLine.length,
            },
            blocks: [header, ...rows],
            inlines: [],
        }
    }
}

export default BlockParser
