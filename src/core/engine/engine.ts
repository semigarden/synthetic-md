import { buildAst } from '../ast/ast'
import { Block, Document, Inline } from '../ast/types'
import { uuid } from '../utils/utils'

export default class Engine {
    public text = ''
    public ast: Document = buildAst('')

    constructor(text = '') {
        this.text = text
        // this.ast = buildAst(text)
        // console.log('engine constructor', JSON.stringify(this.ast, null, 2))
    }
  
    setText(text: string) {
        // if (this.ast.blocks.length === 0) {
        //     this.ast = buildAst(text)
        // }
        this.text = text

        // console.log('init ast', JSON.stringify(this.ast, null, 2))
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
        return this.findBlockByIdRecursive(id, this.ast?.blocks ?? [])
    }

    private findBlockByIdRecursive(targetId: string, blocks: Block[]): Block | null {
        for (const block of blocks) {
            if (block.id === targetId) {
                return block
            }
            if ('blocks' in block && block.blocks) {
                const found = this.findBlockByIdRecursive(targetId, block.blocks)
                if (found) return found
            }
        }
        return null
    }

    getInlineById(id: string): Inline | null {
        return this.findInlineByIdRecursive(id, this.ast?.blocks ?? [])
    }

    private findInlineByIdRecursive(targetId: string, blocks: Block[]): Inline | null {
        for (const block of blocks) {
            for (const inline of block.inlines) {
                if (inline.id === targetId) {
                    return inline
                }
            }

            if ('blocks' in block && block.blocks) {
                const found = this.findInlineByIdRecursive(targetId, block.blocks)
                if (found) return found
            }
        }
        return null
    }
}
