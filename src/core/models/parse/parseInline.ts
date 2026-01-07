import { Block, Inline } from "../../types"
import { parseInlineContent } from '../../ast/ast'

class ParseInline {
    public apply(block: Block): Inline[] {
        const text = block.text ?? ''
        const offset = block.position?.start ?? 0

        if (text.length === 0) {
            return [{
                id: block.id + ':0',
                type: 'text',
                blockId: block.id,
                text: { symbolic: '', semantic: '' },
                position: { start: offset, end: offset },
            }]
        }

        return parseInlineContent(text, block.id, 0)
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
}

export default ParseInline
