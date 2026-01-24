import { Block, CodeBlock, TableRow } from '../../types'
import { uuid } from '../../utils/utils'

class AstNormalizer {
    public text = ''

    public apply(blocks: Block[]) {
        let globalPos = 0

        const stripFencedPayload = (raw: string, open: string, close: string) => {
            let t = raw

            let strippedOpen = false

            if (t.startsWith(open + '\n')) {
                t = t.slice(open.length + 1)
                strippedOpen = true
            } else if (t.startsWith(open)) {
                t = t.slice(open.length)
                if (t.startsWith('\n')) t = t.slice(1)
                strippedOpen = true
            }

            if (close.length > 0) {
                if (t.endsWith('\n' + close)) {
                    t = t.slice(0, t.length - (close.length + 1))
                } else if (t.endsWith(close)) {
                    t = t.slice(0, t.length - close.length)
                }
            }

            if (strippedOpen && t.startsWith('\n')) t = t.slice(1)

            return t
        }

        const updateBlock = (block: Block, listDepth: number = 0): string => {
            const start = globalPos
            let text = ''

            if (!('blocks' in block) || !block.blocks) {
                if (block.type === 'codeBlock') {
                    const codeBlock = block as CodeBlock

                    if (codeBlock.isFenced) {
                        const fenceChar = codeBlock.fenceChar ?? '`'
                        const fenceLength = codeBlock.fenceLength ?? 3
                        const fence = fenceChar.repeat(fenceLength)
                        const indent = codeBlock.openIndent ?? 0
                        const lang = codeBlock.infoString 
                            ? String(codeBlock.infoString).trim() 
                            : (codeBlock.language ? String(codeBlock.language).trim() : '')
                        const open = `${' '.repeat(indent)}${fence}${lang ? lang : ''}`

                        const closeRaw = (codeBlock as any).close ? String((codeBlock as any).close) : ''
                        const close = closeRaw.length > 0 ? closeRaw : ''

                        const raw0 = String(codeBlock.text ?? '')
                        const raw = stripFencedPayload(raw0, open, close)
                        codeBlock.text = raw

                        const body = raw.length === 0 ? '\u200B' : raw
                        const contentSymbolic = body
                        const contentSemantic = raw

                        const openInline = block.inlines.find(i => i.type === 'marker') ?? null
                        const textInline = block.inlines.find(i => i.type === 'text') ?? null
                        const markers = block.inlines.filter(i => i.type === 'marker')
                        const closeInline = markers.length >= 2 ? markers[markers.length - 1] : null

                        const nextInlines = []

                        const m0 = openInline ?? {
                            id: uuid(),
                            type: 'marker',
                            blockId: block.id,
                            text: { symbolic: '', semantic: '' },
                            position: { start: 0, end: 0 },
                        }

                        m0.text.symbolic = open + '\n'
                        m0.text.semantic = ''
                        nextInlines.push(m0)

                        const t0 = textInline ?? {
                            id: uuid(),
                            type: 'text',
                            blockId: block.id,
                            text: { symbolic: '', semantic: '' },
                            position: { start: 0, end: 0 },
                        }

                        t0.text.symbolic = contentSymbolic
                        t0.text.semantic = contentSemantic
                        nextInlines.push(t0)

                        if (close.length > 0) {
                            const m1 = closeInline ?? {
                                id: uuid(),
                                type: 'marker',
                                blockId: block.id,
                                text: { symbolic: '', semantic: '' },
                                position: { start: 0, end: 0 },
                            }

                            m1.text.symbolic = close
                            m1.text.semantic = ''
                            nextInlines.push(m1)
                        }

                        block.inlines = nextInlines as any

                        let localPos = start
                        for (const inline of block.inlines) {
                            if (!inline.id) inline.id = uuid()
                            const len = inline.text.symbolic.length
                            inline.position = { start: localPos, end: localPos + len }
                            localPos += len
                        }

                        const serialized = (open + '\n') + contentSymbolic + (close.length > 0 ? '\n' + close : '')
                        block.position = { start, end: start + serialized.length }
                        globalPos += serialized.length

                        block.text = raw
                        return serialized
                    }

                    if (!codeBlock.isFenced) {
                        const raw = String(codeBlock.text ?? '')
                        const lines = raw.split('\n')
                        const serialized = lines.map(line => '    ' + line).join('\n')

                        const markerInline = block.inlines.find(i => i.type === 'marker')
                        const textInline = block.inlines.find(i => i.type === 'text')
                        
                        if (markerInline) {
                            markerInline.text.symbolic = '    '
                            markerInline.position = { start, end: start + 4 }
                        }
                        
                        if (textInline) {
                            textInline.text.symbolic = raw.length === 0 ? '\u200B' : raw
                            textInline.text.semantic = raw
                            textInline.position = { start: start + 4, end: start + 4 + (raw.length === 0 ? 1 : raw.length) }
                        }
                        
                        block.position = { start, end: start + serialized.length }
                        globalPos += serialized.length
                        
                        return serialized
                    }
                }

                let localPos = 0

                for (const inline of block.inlines) {
                    if (!inline.id) inline.id = uuid()
                    const len = inline.text.symbolic.length
                    inline.position = { start: localPos, end: localPos + len }
                    localPos += len
                }

                text = block.inlines.map(i => i.text.symbolic).join('')
                block.text = text
                block.position = { start, end: start + text.length }
                globalPos += text.length
                return text
            }

            if (block.type === 'list') {
                const parts: string[] = []

                for (let i = 0; i < block.blocks.length; i++) {
                    const itemText = updateBlock(block.blocks[i], listDepth)
                    parts.push(itemText)

                    if (i < block.blocks.length - 1) {
                        parts.push('\n')
                        globalPos += 1
                    }
                }

                text = parts.join('')
                block.text = text
                block.position = { start, end: globalPos }
                return text
            }

            if (block.type === 'taskListItem') {
                const indent = '  '.repeat(listDepth)

                const markerInline = block.inlines.find(i => i.type === 'marker')
                const markerCore = `${block.checked ? '- [x] ' : '- [ ] '}`
                const markerText = indent + markerCore

                if (markerInline) {
                    markerInline.text.symbolic = markerText
                }

                text += markerText
                globalPos += markerText.length

                const content = block.blocks[0] ? updateBlock(block.blocks[0], listDepth) : ''
                text += content

                const nested = block.blocks.find(b => b.type === 'list')
                if (nested) {
                    text += '\n'
                    globalPos += 1
                    text += updateBlock(nested, listDepth + 1)
                }

                block.text = text
                block.position = { start, end: globalPos }
                return text
            }

            if (block.type === 'listItem') {
                const indent = '  '.repeat(listDepth)

                const markerInline = block.inlines.find(i => i.type === 'marker')
                const markerText = (markerInline?.text.symbolic ?? '- ').trimStart()
                const fullMarker = indent + markerText

                if (markerInline) {
                    markerInline.text.symbolic = fullMarker
                }

                text += fullMarker
                globalPos += fullMarker.length

                const content = block.blocks[0] ? updateBlock(block.blocks[0], listDepth) : ''
                text += content

                const nested = block.blocks.find(b => b.type === 'list')
                if (nested) {
                    text += '\n'
                    globalPos += 1
                    text += updateBlock(nested, listDepth + 1)
                }

                block.text = text
                block.position = { start, end: globalPos }
                return text
            }

            if (block.type === 'blockQuote') {
                const parts: string[] = []

                const markerInline = block.inlines?.find(i => i.type === 'marker')
                if (markerInline) {
                    markerInline.text.symbolic = '> '
                }

                for (let i = 0; i < block.blocks.length; i++) {
                    const childText = updateBlock(block.blocks[i], listDepth)
                    const lines = childText.split('\n')

                    for (let li = 0; li < lines.length; li++) {
                        parts.push('> ')
                        globalPos += 2

                        parts.push(lines[li])
                        globalPos += lines[li].length

                        if (li < lines.length - 1) {
                            parts.push('\n')
                            globalPos += 1
                        }
                    }

                    if (i < block.blocks.length - 1) {
                        parts.push('\n')
                        globalPos += 1
                    }
                }

                text = parts.join('')
                block.text = text
                block.position = { start, end: globalPos }
                return text
            }

            if (block.type === 'table') {
                const parts: string[] = []
                const cellCounts = block.blocks.map(r => (r as TableRow).blocks.length)
                const maxCells = cellCounts.length > 0 ? Math.max(...cellCounts) : 1

                block.blocks.forEach((row, rowIndex) => {
                    const rowText = updateBlock(row)
                    parts.push(rowText)

                    if (rowIndex === 0) {
                        parts.push('\n')
                        globalPos += 1

                        const divider = Array(maxCells).fill('---').join(' | ')
                        const dividerLine = `| ${divider} |`
                        parts.push(dividerLine)
                        globalPos += dividerLine.length
                    }

                    if (rowIndex < block.blocks.length - 1) {
                        parts.push('\n')
                        globalPos += 1
                    }
                })

                text = parts.join('')
                block.text = text
                block.position = { start, end: globalPos }
                return text
            }

            if (block.type === 'tableRow') {
                const parts: string[] = []

                parts.push('| ')
                globalPos += 2

                block.blocks.forEach((cell, i) => {
                    const cellText = updateBlock(cell)
                    parts.push(cellText)

                    if (i < block.blocks.length - 1) {
                        parts.push(' | ')
                        globalPos += 3
                    }
                })

                parts.push(' |')
                globalPos += 2

                text = parts.join('')
                block.text = text
                block.position = { start, end: globalPos }
                return text
            }

            if (block.type === 'tableCell' || block.type === 'tableHeader') {
                const parts: string[] = []

                for (let i = 0; i < block.blocks.length; i++) {
                    const childText = updateBlock(block.blocks[i])
                    parts.push(childText)

                    if (i < block.blocks.length - 1) {
                        parts.push('<br>')
                        globalPos += 4
                    }
                }

                const cellText = parts.join('')
                block.text = cellText
                block.position = { start, end: globalPos }

                return cellText
            }

            ;(block as Block).text = text
            ;(block as Block).position = { start, end: globalPos }

            return text
        }

        const parts: string[] = []
        for (let i = 0; i < blocks.length; i++) {
            parts.push(updateBlock(blocks[i], 0))
            if (i < blocks.length - 1) {
                parts.push('\n')
                globalPos += 1
            }
        }

        this.text = parts.join('')

        // console.log('text', this.text)
        // console.log('blocks', JSON.stringify(blocks, null, 2))
    }
}

export default AstNormalizer
