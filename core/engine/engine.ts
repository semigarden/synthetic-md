import { buildAst } from '../ast/ast'
import { Block, Document, Inline } from '../ast/types'
import { uuid } from '../utils/utils'

export default class Engine {
    private text = ''
    private ast: Document | null = null
    public blocks: Block[] = []
    public inlines: Inline[] = []

    constructor(text = '') {
        this.text = text
        this.ast = buildAst(text)
        this.blocks = this.ast?.blocks ?? []
        this.inlines = this.ast?.inlines ?? []
    }
  
    setText(text: string) {
        if (text !== '') {
            this.ast = buildAst(text)
            this.blocks = this.ast?.blocks ?? []
            this.inlines = this.ast?.inlines ?? []

            console.log('buildAst', JSON.stringify(this.ast.blocks, null, 2))
        }
        this.text = text
    }

    getText() {
        return this.text
    }

    getAst() {
        return this.ast
    }

    createBlock(type: any, text: string, position: { start: number, end: number }, inlines: Inline[]): Block {
        const block: Block = {
            id: uuid(),
            type,
            text,
            position,
            inlines,
        }
        return block
    }

    getBlockById(id: string): Block | null {
        return this.findBlockByIdRecursive(id)
    }

    private findBlockByIdRecursive(targetId: string): Block | null {
        for (const block of this.blocks) {
            if (block.id === targetId) {
                return block
            }
            if ('blocks' in block && block.blocks) {
                const found = this.findBlockByIdRecursive(targetId)
                if (found) return found
            }
        }
        return null
    }

    getInlineById(id: string): Inline | null {
        for (const inline of this.inlines) {
            if (inline.id === id) {
                return inline;
            }
        }
      
        return null;
    }
}
