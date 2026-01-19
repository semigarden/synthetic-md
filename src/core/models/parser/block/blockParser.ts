import TableParser from './table/tableParser'
import { detectBlockType } from './blockDetect'
import {
    buildHeading,
    buildThematicBreak,
    buildParagraph,
    buildBlockQuote,
    buildFencedCodeBlock,
    buildIndentedCodeBlock,
    buildListFromItem,
} from './blockBuilders'
import type { ParseBlockContext, Block, DetectedBlock } from '../../../types'

class BlockParser {
    private context: ParseBlockContext
    private tableParser = new TableParser()

    constructor() {
        this.context = {
            isFencedCodeBlock: false,
            codeBlockFence: '',
            currentCodeBlock: null,
            table: undefined,
        }
    }

    public reset() {
        this.context = {
            isFencedCodeBlock: false,
            codeBlockFence: '',
            currentCodeBlock: null,
            table: undefined,
        }
        this.tableParser.reset()
    }

    public get hasPendingTable(): boolean {
        return this.tableParser.hasPendingTable
    }

    public flush(offset: number): Block[] | null {
        return this.tableParser.flush()
    }

    public line(line: string, offset: number): Block[] | null {
        const start = offset
        const end = offset + line.length

        const { isFencedCodeBlock, codeBlockFence, currentCodeBlock } = this.context

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

        if (this.tableParser.hasPendingTable) {
            return this.tableParser.feedLine(line, offset, () => this.parseLine(line, offset))
        }

        if (this.tableParser.tryStartTable(line, start)) {
            return null
        }

        return this.parseLine(line, offset)
    }

    private parseLine(line: string, offset: number): Block[] {
        const blocks: Block[] = []
        const start = offset
        const end = offset + line.length

        const detected: DetectedBlock = detectBlockType(line)

        switch (detected.type) {
            case 'heading':
                blocks.push(buildHeading(line, start, end, detected.level!))
                break

            case 'blockQuote': {
                const match = line.match(/^(\s{0,3}> ?)(.*)$/)
                const marker = match ? match[1] : '>'
                const content = match ? match[2] : ''
                const innerBlocks = this.line(content, start + marker.length) ?? []
                blocks.push(buildBlockQuote(line, start, end, innerBlocks))
                break
            }

            case 'listItem': {
                const list = buildListFromItem(line, start, end, detected)
                const last = blocks[blocks.length - 1]
                if (last && last.type === 'list' && (last as any).ordered === !!(detected as any).ordered) {
                    ;(last as any).blocks.push(...(list as any).blocks)
                    last.position.end = end
                } else {
                    blocks.push(list)
                }
                break
            }

            case 'codeBlock': {
                const fenceMatch = line.match(/^(\s{0,3})(```+|~~~+)(.*)$/)
                if (fenceMatch) {
                    const block = buildFencedCodeBlock(
                        line,
                        start,
                        end,
                        fenceMatch[2],
                        fenceMatch[3].trim() || undefined
                    )
                    blocks.push(block)
                    this.context.isFencedCodeBlock = true
                    this.context.codeBlockFence = fenceMatch[2]
                    this.context.currentCodeBlock = block
                } else {
                    blocks.push(buildIndentedCodeBlock(line, start, end))
                }
                break
            }

            case 'thematicBreak':
                blocks.push(buildThematicBreak(line, start, end))
                break

            case 'blankLine':
                blocks.push(buildParagraph(line, start, end))
                break

            default:
                blocks.push(buildParagraph(line, start, end))
        }

        return blocks
    }
}

export default BlockParser
