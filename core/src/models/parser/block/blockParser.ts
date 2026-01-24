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
import type { ParseBlockContext, Block, DetectedBlock, CodeBlock } from '../../../types'

class BlockParser {
    private context: ParseBlockContext
    private tableParser = new TableParser()

    constructor() {
        this.context = {
            isFencedCodeBlock: false,
            codeBlockFence: '',
            codeBlockIndent: 0,
            currentCodeBlock: null,
            codeBlockLineCount: 0,
            table: undefined,
        }
    }

    public reset() {
        this.context = {
            isFencedCodeBlock: false,
            codeBlockFence: '',
            codeBlockIndent: 0,
            currentCodeBlock: null,
            codeBlockLineCount: 0,
            table: undefined,
        }
        this.tableParser.reset()
    }

    public get hasPendingTable(): boolean {
        return this.tableParser.hasPendingTable
    }

    public flush(offset: number): Block[] | null {
        const { isFencedCodeBlock, currentCodeBlock } = this.context

        if (isFencedCodeBlock && currentCodeBlock) {
            ;(currentCodeBlock as CodeBlock).position.end = offset
            this.context.isFencedCodeBlock = false
            this.context.codeBlockFence = ''
            this.context.codeBlockIndent = 0
            this.context.currentCodeBlock = null
            this.context.codeBlockLineCount = 0
        }

        return this.tableParser.flush()
    }

    public line(line: string, offset: number): Block[] | null {
        const start = offset
        const end = offset + line.length

        const { isFencedCodeBlock, codeBlockFence, codeBlockIndent, currentCodeBlock } = this.context

        if (isFencedCodeBlock && currentCodeBlock) {
            const fenceChar = codeBlockFence.charAt(0)
          
            const closeMatch = line.match(
                new RegExp(`^\\s{0,3}${this.escapeRegex(fenceChar)}{${codeBlockFence.length},}\\s*$`)
            )
          
            if (closeMatch) {
                const closeFenceMatch = line.match(
                    new RegExp(`^(\\s{0,3})(${this.escapeRegex(fenceChar)}{${codeBlockFence.length},})`)
                )
                const closeFence = closeFenceMatch
                    ? closeFenceMatch[2]
                    : fenceChar.repeat(codeBlockFence.length)
            
                ;(currentCodeBlock as CodeBlock).close = closeFence
            
                currentCodeBlock.position.end = end
                this.context.isFencedCodeBlock = false
                this.context.codeBlockFence = ''
                this.context.codeBlockIndent = 0
                this.context.currentCodeBlock = null
                this.context.codeBlockLineCount = 0
                return null
            }
        
            let contentLine = line
            if (codeBlockIndent > 0) {
                const indentMatch = line.match(new RegExp(`^\\s{0,${codeBlockIndent}}`))
                if (indentMatch) {
                    contentLine = line.slice(indentMatch[0].length)
                }
            }
          
            const isFirst = this.context.codeBlockLineCount === 0
            if (isFirst) {
                currentCodeBlock.text = contentLine
            } else {
                currentCodeBlock.text = currentCodeBlock.text + '\n' + contentLine
            }
            this.context.codeBlockLineCount++
          
            currentCodeBlock.position.end = end + 1
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
    
    private escapeRegex(str: string): string {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
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

            case 'taskListItem': {
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
                    const indent = fenceMatch[1].length
                    const fence = fenceMatch[2]
                    const rawInfo = fenceMatch[3] ?? ''
                    const info = rawInfo.trim()

                    if (fence.charAt(0) === '`' && /`/.test(info)) {
                        blocks.push(buildParagraph(line, start, end))
                        break
                    }

                    const block = buildFencedCodeBlock(start, end, fence, info || undefined, indent)
                    blocks.push(block)
                    this.context.isFencedCodeBlock = true
                    this.context.codeBlockFence = fence
                    this.context.currentCodeBlock = block
                    this.context.codeBlockLineCount = 0
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
