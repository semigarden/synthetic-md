import { Block, Inline } from "../../types"
import { uuid } from "../../utils/utils"

class AstNormalizer {
    public text = ''

    public apply(blocks: Block[]) {
        let globalPos = 0

        const updateBlock = (block: Block): string => {
            const start = globalPos
            let text = ''

            if (!('blocks' in block) || !block.blocks) {
                let localPos = 0

                for (const inline of block.inlines) {
                    if (!inline.id) inline.id = uuid()
                        const len = inline.text.symbolic.length
                        inline.position = {
                        start: localPos,
                        end: localPos + len,
                    }
                    localPos += len
                }

                text = block.inlines.map((i: Inline) => i.text.symbolic).join('')
                block.text = text
                block.position = { start, end: start + text.length }
                globalPos += text.length

                return text
            }

            if (block.type === 'list') {
                const parts: string[] = []

                for (let i = 0; i < block.blocks.length; i++) {
                    const item = block.blocks[i]
                    const itemText = updateBlock(item)
                    parts.push(itemText)

                    if (i < block.blocks.length - 1) {
                        parts.push('\n')
                        globalPos += 1
                    }
                }

                text = parts.join('')
            }

            else if (block.type === 'listItem') {
                const marker = '- '
                text += marker
                globalPos += marker.length

                const content = updateBlock(block.blocks[0])
                text += content
            }

            block.text = text
            block.position = { start, end: globalPos }

            return text
        }

        const parts: string[] = []
        for (let i = 0; i < blocks.length; i++) {
            parts.push(updateBlock(blocks[i]))
            if (i < blocks.length - 1) {
                parts.push('\n')
                globalPos += 1
            }
        }

        this.text = parts.join('')
    }
}

export default AstNormalizer
