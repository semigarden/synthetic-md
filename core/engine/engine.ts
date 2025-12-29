import { buildAst } from '../ast/ast'
import { Document } from '../ast/types'

export default class Engine {
    private source = ''
    private ast: Document

    constructor(source = '') {
        this.source = source
        this.ast = buildAst(source)
    }

    setSource(source: string) {
        this.source = source
        this.ast = buildAst(source)

        console.log('ast', JSON.stringify(this.ast, null, 2))
    }

    getSource() {
        return this.source
    }

    getAst() {
        return this.ast
    }
}
