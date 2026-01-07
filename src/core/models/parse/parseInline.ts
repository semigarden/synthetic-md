import InlineStream from './inline/inlineStream'
import LinkResolver from './inline/resolve/linkResolver'
import ImageResolver from './inline/resolve/imageResolver'
import CodeSpanResolver from './inline/resolve/codeSpanResolver'
import EntityResolver from './inline/resolve/entityResolver'
import BackslashEscapeResolver from './inline/resolve/backslashEscapeResolver'
import EmphasisResolver from './inline/resolve/emphasisResolver'
import DelimiterLexer from './inline/delimiterLexer'
import LinkReferenceState from './linkReferenceState'
import { Block, Inline, CodeBlock, TableCell, Paragraph, Delimiter } from '../../types'
import { uuid, decodeHTMLEntity } from '../../utils/utils'

class ParseInline {
    private linkResolver: LinkResolver
    private imageResolver = new ImageResolver()
    private codeSpanResolver = new CodeSpanResolver()
    private entityResolver = new EntityResolver()
    private backslashEscapeResolver = new BackslashEscapeResolver()
    private emphasisResolver = new EmphasisResolver()
    private delimiterLexer = new DelimiterLexer()

    constructor(private linkReferences: LinkReferenceState) {
        this.linkResolver = new LinkResolver(this.linkReferences)
    }

    public apply(block: Block): Inline[] {
        const inlines: Inline[] = []
        const text = block.text ?? ''
        const blockId = block.id

        if (text === '') {
            inlines.push({
                id: uuid(),
                type: 'text',
                blockId,
                text: { symbolic: '', semantic: '' },
                position: { start: 0, end: 0 },
            })
            return inlines
        }

        if (block.type === 'codeBlock') {
            const codeBlock = block as CodeBlock
            const semantic = codeBlock.isFenced
                ? this.extractFencedCodeContent(text, codeBlock.fence!)
                : text

            inlines.push({
                id: uuid(),
                type: 'text',
                blockId,
                text: {
                    symbolic: text,
                    semantic,
                },
                position: {
                    start: 0,
                    end: text.length,
                },
            })

            return inlines
        }

        let parseText = text
        let textOffset = 0

        if (block.type === 'heading') {
            const match = text.match(/^(#{1,6})\s+/)
            if (match) {
                textOffset = match[0].length
                parseText = text.slice(textOffset)
            }
        }

        const newInlines = this.lexInline(
            parseText,
            blockId,
            textOffset
        )

        for (const inline of newInlines) {
            inlines.push({
                ...inline,
                id: uuid(),
                blockId,
            })
        }

        return inlines
    }

    public applyRecursive(block: Block) {
        switch (block.type) {
            case 'paragraph':
            case 'heading':
            case 'codeBlock': {
                block.inlines = this.apply(block)
                return
            }

            default:
                if ('blocks' in block && Array.isArray(block.blocks)) {
                    for (const child of block.blocks) {
                        this.applyRecursive(child)
                    }
                }
        }
    }

    public lexInline(text: string, blockId: string, position: number = 0): Inline[] {
        const stream = new InlineStream(text)
        const result: Inline[] = []
        const delimiterStack: Delimiter[] = []

        let textStart = 0

        const flushText = () => {
            const end = stream.position()
            if (end > textStart) {
                const raw = text.slice(textStart, end)
                result.push({
                    id: uuid(),
                    type: 'text',
                    blockId,
                    text: {
                        symbolic: raw,
                        semantic: decodeHTMLEntity(raw),
                    },
                    position: {
                        start: position + textStart,
                        end: position + end,
                    },
                })
            }
            textStart = stream.position()
        }

        while (!stream.end()) {
            const ch = stream.peek()!

            // backslash escape
            const escape = this.backslashEscapeResolver.tryParse(
                stream,
                blockId,
                position
            )

            if (escape) {
                flushText()
                result.push(escape)
                textStart = stream.position()
                continue
            }

            // entity
            if (ch === '&') {
                const entity = this.entityResolver.tryParse(
                    stream,
                    text,
                    blockId,
                    position
                )
            
                if (entity) {
                    flushText()
                    result.push(entity)
                    textStart = stream.position()
                    continue
                }
            }            

            // code span
            if (ch === '`') {
                const codeSpan = this.codeSpanResolver.tryParse(
                    stream,
                    text,
                    blockId,
                    position
                )
            
                if (codeSpan) {
                    flushText()
                    result.push(codeSpan)
                    textStart = stream.position()
                    continue
                }
            }            

            // image
            if (ch === '!' && stream.peek(1) === '[') {
                const image = this.imageResolver.tryParse(stream, blockId, position)
                if (image) {
                    flushText()
                    result.push(image)
                    textStart = stream.position()
                    continue
                }
            }

            // link
            if (ch === '[') {
                const link = this.linkResolver.tryParse(stream, blockId, position)
                if (link) {
                    flushText()
                    result.push(link)
                    textStart = stream.position()
                    continue
                }
            }

            // delimiter lexer
            if (this.delimiterLexer.tryLex(
                stream,
                blockId,
                position,
                result,
                delimiterStack
            )) {
                flushText()
                textStart = stream.position()
                continue
            }

            stream.next()
        }

        flushText()
        this.emphasisResolver.apply(result, delimiterStack, blockId)

        return result.length
            ? result
            : [{
                id: uuid(),
                type: 'text',
                blockId,
                text: { symbolic: '', semantic: '' },
                position: { start: position, end: position },
            }]
    }

    private parseTableRow(line: string): TableCell[] {
        const cellTexts: string[] = []
        let current = ''
        let escaped = false
        let inCode = false
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i]
            
            if (escaped) {
                current += char
                escaped = false
                continue
            }
            
            if (char === '\\') {
                escaped = true
                current += char
                continue
            }
            
            if (char === '`') {
                inCode = !inCode
                current += char
                continue
            }
            
            if (char === '|' && !inCode) {
                cellTexts.push(current)
                current = ''
                continue
            }
            
            current += char
        }
        
        if (current || cellTexts.length > 0) {
            cellTexts.push(current)
        }
        
        if (cellTexts.length > 0 && cellTexts[0].trim() === '') cellTexts.shift()
        if (cellTexts.length > 0 && cellTexts[cellTexts.length - 1].trim() === '') cellTexts.pop()

        let cells: TableCell[] = []
        for (const cellText of cellTexts) {
            const paragraph: Paragraph = {
                id: uuid(),
                type: 'paragraph',
                text: cellText,
                position: {
                    start: 0,
                    end: cellText.length,
                },
                inlines: [],
            };

            cells.push({
                id: uuid(),
                type: 'tableCell',
                text: cellText,
                position: {
                    start: 0,
                    end: cellText.length,
                },
                blocks: [paragraph],
                inlines: [],
            });
        }
        
        return cells;
    }

    private extractFencedCodeContent(text: string, fence: string): string {
        const lines = text.split('\n');
        if (lines.length <= 1) return '';
        const contentLines = lines.slice(1);
        const closingPattern = new RegExp(`^\\s{0,3}${fence.charAt(0)}{${fence.length},}\\s*$`);
        if (contentLines.length > 0 && closingPattern.test(contentLines[contentLines.length - 1])) {
            contentLines.pop();
        }
        return contentLines.join('\n');
    }

    public parseLinkReferenceDefinitions(text: string) {
        const refRegex = /^\[([^\]]+)\]:\s*<?([^\s>]+)>?(?:\s+["'(]([^"')]+)["')])?$/gm

        let match: RegExpExecArray | null

        while ((match = refRegex.exec(text)) !== null) {
            const label = match[1].toLowerCase().trim()
            const url = match[2]
            const title = match[3]

            this.linkReferences.set(label, {
                url,
                title,
            })
        }
    }
}

export default ParseInline
