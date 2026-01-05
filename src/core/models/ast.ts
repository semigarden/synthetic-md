import { buildAst } from '../ast/ast'
import { Block, Document, Inline } from '../ast/types'
import { uuid } from '../utils/utils'

class AST {
    public text = ''
    public ast: Document = buildAst('')

    constructor(text = '') {
        this.text = text
    }
  
    setText(text: string) {
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

    public updateAST() {
        console.log('updateAST', JSON.stringify(this.ast, null, 2))
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
        for (let i = 0; i < this.ast.blocks.length; i++) {
            parts.push(updateBlock(this.ast.blocks[i]))
            if (i < this.ast.blocks.length - 1) {
                parts.push('\n')
                globalPos += 1
            }
        }

        this.text = parts.join('')



        // console.log('ast', JSON.stringify(ast, null, 2))
    }
}

export default AST
