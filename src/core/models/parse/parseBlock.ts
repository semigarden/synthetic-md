import { ParseBlockContext, Block, Inline, DetectedBlock, Marker } from "../../types"
import { uuid } from "../../utils/utils"

class ParseBlock {
    private context: ParseBlockContext

    constructor() {
        this.context = {
            isFencedCodeBlock: false,
            codeBlockFence: '',
            currentCodeBlock: null,
        }
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

                const markerText = '#'.repeat(detected.level!) + ' '
                const marker: Marker = {
                    id: uuid(),
                    type: 'marker',
                    blockId: block.id,
                    text: { symbolic: markerText, semantic: '' },
                    position: { start: start, end: start + markerText.length },
                }
                block.inlines.push(marker)
                break
            }

            case 'blockQuote': {
                const content = line.replace(/^>\s?/, '')
                block = {
                    id: uuid(),
                    type: 'blockQuote',
                    text: content,
                    position: { start, end },
                    blocks: [],
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
    
        if (/^ {4,}[^ ]/.test(line)) {
            return { type: 'codeBlock' }
        }
    
        const taskListMatch = /^\s{0,3}([-*+])\s+\[([ xX])\]\s+/.exec(line);
        if (taskListMatch) {
            return { 
                type: 'taskListItem', 
                ordered: false,
                checked: taskListMatch[2].toLowerCase() === 'x'
            }
        }
    
        const unorderedListMatch = /^\s{0,3}([-*+])\s+/.exec(line);
        if (unorderedListMatch) {
            return { type: 'listItem', ordered: false }
        }
    
        const orderedListMatch = /^\s{0,3}(\d{1,9})([.)])\s+/.exec(line);
        if (orderedListMatch) {
            return { 
                type: 'listItem', 
                ordered: true,
                listStart: parseInt(orderedListMatch[1], 10)
            }
        }
    
        if (/\|/.test(trimmed) && !/^\|[-:\s|]+\|$/.test(trimmed)) {
            if (!/^[-:\s|]+$/.test(trimmed.replace(/^\||\|$/g, ''))) {
                return { type: 'table' }
            }
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
        }
    }
}

export default ParseBlock
