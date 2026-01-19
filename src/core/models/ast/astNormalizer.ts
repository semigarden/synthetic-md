import { Block, TableRow } from '../../types'
import { uuid } from '../../utils/utils'

class AstNormalizer {
    public text = ''

    public apply(blocks: Block[]) {
        let globalPos = 0

        const updateBlock = (block: Block, listDepth: number = 0): string => {
            const start = globalPos
            let text = ''

            if (!('blocks' in block) || !block.blocks) {
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

                for (let i = 0; i < block.blocks.length; i++) {
                    const childText = updateBlock(block.blocks[i], listDepth)
                    parts.push('> ' + childText)

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
    }
}

export default AstNormalizer
