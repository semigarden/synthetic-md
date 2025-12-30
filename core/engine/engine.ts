import { buildAst } from '../ast/ast'
import { Document } from '../ast/types'
import { diffAst, AstDiff, printDiff } from '../diff/diff'

export default class Engine {
    private source = ''
    private ast: Document
    private previousAst: Document | null = null
    private lastDiff: AstDiff | null = null

    constructor(source = '') {
        this.source = source
        this.ast = buildAst(source)
    }

    setSource(source: string) {
        this.source = source
        this.previousAst = this.ast
        this.ast = buildAst(source)

        this.lastDiff = diffAst(this.previousAst, this.ast)
        if (this.lastDiff.hasChanges) {
            printDiff(this.lastDiff)
        }
    }

    getSource() {
        return this.source
    }

    getAst() {
        return this.ast
    }

    getPreviousAst() {
        return this.previousAst
    }

    getLastDiff() {
        return this.lastDiff
    }

    getInlineIdByPosition(position: number) {
        return this.ast.inlines.find(inline => position >= inline.position.start && position <= inline.position.end)?.id ?? null
    }

    getInlineById(id: string) {
        return this.ast.inlines.find(inline => inline.id === id) ?? null
    }
}
