import { ParseBlockContext, Block, Inline } from "../../types"
import { detectType } from "../../ast/ast"
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

        const detected = detectType(line)
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

                const inline: Inline = {
                    id: uuid(),
                    type: 'text',
                    blockId: block.id,
                    text: { symbolic: '', semantic: '' },
                    position: { start: 0, end: 0 },
                }

                block.inlines.push(inline)
                blocks.push(block)
                break
            }
        }

        return blocks
    }

    reset() {
        this.context = {
            isFencedCodeBlock: false,
            codeBlockFence: '',
            currentCodeBlock: null,
        }
    }
}

export default ParseBlock
