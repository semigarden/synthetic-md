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

            if (codeBlock.isFenced) {
                const fenceChar = codeBlock.fenceChar ?? '`'
                const fenceLength = codeBlock.fenceLength ?? 3
                const fence = fenceChar.repeat(fenceLength)
                const indent = codeBlock.openIndent ?? 0
                const lang = codeBlock.language ? String(codeBlock.language).trim() : ''

                const open = `${' '.repeat(indent)}${fence}${lang ? lang : ''}\n`
                const closeRaw = (codeBlock as any).close ? String((codeBlock as any).close) : ''
                const close = closeRaw.length > 0 ? closeRaw : ''

                const raw = text
                const body = raw.length === 0 ? '\u200B' : raw
                const contentSymbolic = body
                const contentSemantic = raw

                const base = block.position?.start ?? 0
                const openStart = base
                const openEnd = openStart + open.length

                const contentStart = openEnd
                const contentEnd = contentStart + contentSymbolic.length

                const inlines: Inline[] = [
                    {
                        id: uuid(),
                        type: 'marker',
                        blockId: block.id,
                        text: { symbolic: open, semantic: '' },
                        position: { start: openStart, end: openEnd },
                    },
                    {
                        id: uuid(),
                        type: 'text',
                        blockId: block.id,
                        text: { symbolic: contentSymbolic, semantic: contentSemantic },
                        position: { start: contentStart, end: contentEnd },
                    },
                ]

                if (close.length > 0) {
                    const closeStart = contentEnd
                    const closeEnd = closeStart + close.length

                    inlines.push({
                        id: uuid(),
                        type: 'marker',
                        blockId: block.id,
                        text: { symbolic: close, semantic: '' },
                        position: { start: closeStart, end: closeEnd },
                    })
                }

                return inlines
            }

            const base = block.position?.start ?? 0
            const open = '    '
            const openStart = base
            const openEnd = openStart + open.length
            const codeStart = openEnd

            return [
                {
                    id: uuid(),
                    type: 'marker',
                    blockId: block.id,
                    text: { symbolic: open, semantic: '' },
                    position: { start: openStart, end: openEnd },
                },
                {
                    id: uuid(),
                    type: 'text',
                    blockId: block.id,
                    text: { symbolic: text.length === 0 ? '\u200B' : text, semantic: text },
                    position: { start: codeStart, end: codeStart + (text.length === 0 ? 1 : text.length) },
                },
            ]
        }

        const inlines = this.parseInline(text, block.id, block.type, 0)
        return inlines.map(i => ({ ...i, id: uuid(), blockId: block.id }))
    }

    public applyRecursive(block: Block) {
        if (block.type === 'tableCell' || block.type === 'listItem' || block.type === 'taskListItem' || block.type === 'blockQuote') {
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
                text: { symbolic: '\u200B', semantic: '' },
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

        let changed = true
        while (changed) {
            const activeBefore = delimiterStack.filter(d => d.active).length

            this.emphasisResolver.apply(result, delimiterStack, blockId)
            this.pruneDelimiters(delimiterStack, result)

            this.strikethroughResolver.apply(result, delimiterStack, blockId)
            this.pruneDelimiters(delimiterStack, result)

            const activeAfter = delimiterStack.filter(d => d.active).length
            changed = activeAfter < activeBefore
        }

        return result
    }

    private pruneDelimiters(delimiters: Delimiter[], nodes: Inline[]) {
        for (const d of delimiters) {
            if (
                !d.active ||
                d.position < 0 ||
                d.position >= nodes.length
            ) {
                d.active = false
            }
        }
    }
}

export default InlineParser
