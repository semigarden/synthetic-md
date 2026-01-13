import InlineStream from './inlineStream'
import MarkerResolver from './resolve/markerResolver'
import LinkResolver from './resolve/linkResolver'
import AutoLinkResolver from './resolve/autoLinkResolver'
import ImageResolver from './resolve/imageResolver'
import CodeSpanResolver from './resolve/codeSpanResolver'
import EntityResolver from './resolve/entityResolver'
import BackslashEscapeResolver from './resolve/backslashEscapeResolver'
import EmphasisResolver from './resolve/emphasisResolver'
import DelimiterResolver from './resolve/delimiterResolver'
import StrikethroughResolver from './resolve/strikethroughResolver'
import LinkReferenceState from '../ast/linkReferenceState'
import { Block, Inline, CodeBlock, Delimiter } from '../../../types'
import { uuid, decodeHTMLEntity } from '../../../utils/utils'

class InlineParser {
    private markerResolver = new MarkerResolver()
    private linkResolver = new LinkResolver()
    private autoLinkResolver = new AutoLinkResolver()
    private imageResolver = new ImageResolver()
    private codeSpanResolver = new CodeSpanResolver()
    private entityResolver = new EntityResolver()
    private backslashEscapeResolver = new BackslashEscapeResolver()
    private emphasisResolver = new EmphasisResolver()
    private strikethroughResolver = new StrikethroughResolver()
    private delimiterResolver = new DelimiterResolver()

    constructor(private linkReferences: LinkReferenceState) {}

    public apply(block: Block): Inline[] {
        const text = block.text ?? ''

        if (block.type === 'codeBlock') {
            const codeBlock = block as CodeBlock
            const semantic = codeBlock.isFenced
                ? this.extractFencedCodeContent(text, codeBlock.fence!)
                : text

            return [{
                id: uuid(),
                type: 'text',
                blockId: block.id,
                text: { symbolic: text, semantic },
                position: { start: 0, end: text.length },
            }]
        }

        let parseText = text
        let textOffset = 0
        const inlines = this.parseInline(parseText, block.id, block.type, textOffset)

        return inlines.map(i => ({ ...i, id: uuid(), blockId: block.id }))
    }

    public applyRecursive(block: Block) {
        if (block.type === 'tableCell' || block.type === 'listItem') {
            block.inlines = this.apply(block)
        }
        if ('blocks' in block && Array.isArray(block.blocks)) {
            block.blocks.forEach(b => this.applyRecursive(b))
        } else if (['paragraph', 'heading', 'codeBlock', 'thematicBreak'].includes(block.type)) {
            block.inlines = this.apply(block)
        }
    }

    public parseInline(text: string, blockId: string, blockType: string, position: number = 0): Inline[] {
        const stream = new InlineStream(text)
        const result: Inline[] = []
        const delimiterStack: Delimiter[] = []
        let textStart = 0

        if (text.length === 0) {
            result.push({
                id: uuid(),
                type: 'text',
                blockId,
                text: { symbolic: '', semantic: '' },
                position: { start: position, end: position }
            })

            return result
        }

        const flushText = () => {
            const end = stream.position()
            if (end > textStart) {
                const raw = text.slice(textStart, end)
                result.push({
                    id: uuid(),
                    type: 'text',
                    blockId,
                    text: { symbolic: raw, semantic: decodeHTMLEntity(raw) },
                    position: { start: position + textStart, end: position + end }
                })
            }
            textStart = stream.position()
        }
    
        while (!stream.end()) {
            const ch = stream.peek()!

            // Marker
            if (stream.position() === 0) {
                const marker = this.markerResolver.tryParse(stream, text, blockId, blockType, position)
                if (marker) {
                    result.push(marker)
                    textStart = stream.position()
                    continue
                }
            }
    
            // Backslash escapes
            const escape = this.backslashEscapeResolver.tryParse(stream, blockId, position)
            if (escape) {
                flushText()
                result.push(escape)
                textStart = stream.position()
                continue
            }
    
            // HTML entities
            if (ch === '&') {
                flushText()
                const entity = this.entityResolver.tryParse(stream, text, blockId, position)
                if (entity) {
                    result.push(entity)
                    textStart = stream.position()
                    continue
                }
            }
    
            // Code spans
            if (ch === '`') {
                flushText()
                const code = this.codeSpanResolver.tryParse(stream, text, blockId, position)
                if (code) {
                    result.push(code)
                    textStart = stream.position()
                    continue
                }
            }
    
            // Images
            if (ch === '!' && stream.peek(1) === '[') {
                flushText()
                const img = this.imageResolver.tryParse(stream, blockId, position)
                if (img) {
                    result.push(img)
                    textStart = stream.position()
                    continue
                }
            }
    
            // Links
            if (ch === '[') {
                flushText()
                const link = this.linkResolver.tryParse(stream, blockId, position)
                if (link) {
                    result.push(link)
                    textStart = stream.position()
                    continue
                }
            }

            // Autolinks
            if (ch === '<') {
                flushText()
                const autolink = this.autoLinkResolver.tryParse(stream, blockId, position)
                if (autolink) {
                    result.push(autolink)
                    textStart = stream.position()
                    continue
                }   
            }
    
            // Delimiters (*, _, ~)
            if (ch === '*' || ch === '_' || ch === '~') {
                flushText()
                if (this.delimiterResolver.tryParse(stream, blockId, position, result, delimiterStack)) {
                    textStart = stream.position()
                    continue
                }
            }
    
            stream.next()
        }
    
        flushText()

        this.emphasisResolver.apply(result, delimiterStack, blockId)
        this.strikethroughResolver.apply(result, delimiterStack, blockId)

        return result
    }

    private extractFencedCodeContent(text: string, fence: string): string {
        const lines = text.split('\n')
        if (lines.length <= 1) return ''
        const content = lines.slice(1)
        const closingPattern = new RegExp(`^\\s{0,3}${fence.charAt(0)}{${fence.length},}\\s*$`)
        if (closingPattern.test(content[content.length - 1])) content.pop()
        return content.join('\n')
    }
}

export default InlineParser
