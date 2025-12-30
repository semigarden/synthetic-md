import { buildAst } from '../ast/ast'
import { Document, Inline } from '../ast/types'
import { diff, Change } from '../diff/diff'

export default class Engine {
    private source = ''
    private ast: Document
    private previousAst: Document | null = null
    private lastDiff: Change[] = []
  
    constructor(source = '') {
      this.source = source
      this.ast = buildAst(source)
      this.previousAst = null
    }
  
    setSource(source: string) {
      const prevAst = this.ast
      const nextAst = buildAst(source, prevAst)
  
      const changes = diff(prevAst, nextAst)
  
      this.previousAst = prevAst
      this.lastDiff = changes
      this.source = source
      this.ast = nextAst
    }
  
    getLastDiff(): Change[] {
      return this.lastDiff
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

    getInlineIdByPosition(position: number) {
        return this.ast.inlines.find(inline => position >= inline.position.start && position <= inline.position.end)?.id ?? null
    }

    getInlineById(id: string): Inline | null {
        return this.findInlineByIdRecursive(this.ast.inlines, id)
      }
    
    private findInlineByIdRecursive(inlines: Inline[], targetId: string): Inline | null {
    for (const inline of inlines) {
        if (inline.id === targetId) {
        return inline
        }
    
        if ('inlines' in inline && inline.inlines && inline.inlines.length > 0) {
        const found = this.findInlineByIdRecursive(inline.inlines, targetId)
        if (found) {
            return found
        }
        }
    }
    return null
    }
}
