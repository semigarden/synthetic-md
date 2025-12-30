import { buildAst } from '../ast/ast'
import { Document } from '../ast/types'

export default class Engine {
    private text = ''
    private ast: Document | null = null

    constructor(text = '') {
        this.text = text
    }
  
    setText(text: string) {
        if (this.text === '' && text !== '') {
            this.text = text
            this.ast = buildAst(text)
            console.log('buildAst', JSON.stringify(this.ast, null, 2))
        }
    }

    getText() {
        return this.text
    }

    getAst() {
        return this.ast
    }
}
