import AstNormalizer from './astNormalizer'
import AstMutation from './astMutation'
import AstQuery from './astQuery'
import AstParser from '../parser/ast/astParser'
import AstTransform from './transform/astTransform'
import Effect from './effect/effect'
import Edit from './edit'
import type { AstContext } from './astContext'
import type { Block } from '../../types'

class Ast {
    public text = ''
    public blocks: Block[] = []

    private effect = new Effect()
    private parser = new AstParser()
    private normalizer = new AstNormalizer()
    private mutation = new AstMutation(this, this.parser)
    private _query = new AstQuery(this.blocks)
    private transform: AstTransform
    private edit: Edit

    constructor(text = '') {
        this.text = text
        this.updateQuery()
        
        const createContext = (transform: AstTransform | undefined): AstContext => {
            const ctx: any = {
                ast: this,
                parser: this.parser,
                mutation: this.mutation,
                transform: transform as AstTransform,
                effect: this.effect,
            }
            
            Object.defineProperty(ctx, 'query', {
                get: () => this.query,
                enumerable: true,
                configurable: true,
            })
            
            return ctx as AstContext
        }
        
        this.transform = new AstTransform(createContext(undefined))
        this.edit = new Edit(createContext(this.transform))
    }

    setText(text: string) {
        this.text = text
        this.blocks = this.parser.parse(text)
        this.updateQuery()
    }

    private updateQuery() {
        this._query = new AstQuery(this.blocks)
    }

    public get query() {
        return this._query
    }

    public normalize() {
        this.normalizer.apply(this.blocks)
        this.text = this.normalizer.text
    }

    public input(...args: Parameters<Edit['input']>) { return this.edit.input(...args) }
    public split(...args: Parameters<Edit['split']>) { return this.edit.split(...args) }
    public splitListItem(...args: Parameters<Edit['splitListItem']>) { return this.edit.splitListItem(...args) }
    public splitTaskListItem(...args: Parameters<Edit['splitTaskListItem']>) { return this.edit.splitTaskListItem(...args) }
    public splitBlockQuote(...args: Parameters<Edit['splitBlockQuote']>) { return this.edit.splitBlockQuote(...args) }
    public splitCodeBlockFromMarker(...args: Parameters<Edit['splitCodeBlockFromMarker']>) { return this.edit.splitCodeBlockFromMarker(...args) }
    public mergeInline(...args: Parameters<Edit['mergeInline']>) { return this.edit.mergeInline(...args) }
    public indentListItem(...args: Parameters<Edit['indentListItem']>) { return this.edit.indentListItem(...args) }
    public indentTaskListItem(...args: Parameters<Edit['indentTaskListItem']>) { return this.edit.indentTaskListItem(...args) }
    public indentBlockQuote(...args: Parameters<Edit['indentBlockQuote']>) { return this.edit.indentBlockQuote(...args) }
    public outdentListItem(...args: Parameters<Edit['outdentListItem']>) { return this.edit.outdentListItem(...args) }
    public outdentTaskListItem(...args: Parameters<Edit['outdentTaskListItem']>) { return this.edit.outdentTaskListItem(...args) }
    public outdentBlockQuote(...args: Parameters<Edit['outdentBlockQuote']>) { return this.edit.outdentBlockQuote(...args) }
    public mergeTableCell(...args: Parameters<Edit['mergeTableCell']>) { return this.edit.mergeTableCell(...args) }
    public addTableColumn(...args: Parameters<Edit['addTableColumn']>) { return this.edit.addTableColumn(...args) }
    public addTableRow(...args: Parameters<Edit['addTableRow']>) { return this.edit.addTableRow(...args) }
    public addTableRowAbove(...args: Parameters<Edit['addTableRowAbove']>) { return this.edit.addTableRowAbove(...args) }
    public splitTableCell(...args: Parameters<Edit['splitTableCell']>) { return this.edit.splitTableCell(...args) }
    public splitTableCellAtCaret(...args: Parameters<Edit['splitTableCellAtCaret']>) { return this.edit.splitTableCellAtCaret(...args) }
    public mergeBlocksInCell(...args: Parameters<Edit['mergeBlocksInCell']>) { return this.edit.mergeBlocksInCell(...args) }
    public mergeInlineInCell(...args: Parameters<Edit['mergeInlineInCell']>) { return this.edit.mergeInlineInCell(...args) }
    public insertParagraphAboveTable(...args: Parameters<Edit['insertParagraphAboveTable']>) { return this.edit.insertParagraphAboveTable(...args) }
    public insertParagraphBelowTable(...args: Parameters<Edit['insertParagraphBelowTable']>) { return this.edit.insertParagraphBelowTable(...args) }
    public pasteMultiBlock(...args: Parameters<Edit['pasteMultiBlock']>) { return this.edit.pasteMultiBlock(...args) }
    public deleteMultiBlock(...args: Parameters<Edit['deleteMultiBlock']>) { return this.edit.deleteMultiBlock(...args) }
    public toggleTask(...args: Parameters<Edit['toggleTask']>) { return this.edit.toggleTask(...args) }
    public inputCodeBlock(...args: Parameters<Edit['inputCodeBlock']>) { return this.edit.inputCodeBlock(...args) }
    public splitCodeBlock(...args: Parameters<Edit['splitCodeBlock']>) { return this.edit.splitCodeBlock(...args) }
    public mergeCodeBlockContent(...args: Parameters<Edit['mergeCodeBlockContent']>) { return this.edit.mergeCodeBlockContent(...args) }
    public exitCodeBlock(...args: Parameters<Edit['exitCodeBlock']>) { return this.edit.exitCodeBlock(...args) }
    public unwrapCodeBlock(...args: Parameters<Edit['unwrapCodeBlock']>) { return this.edit.unwrapCodeBlock(...args) }
    public setCodeBlockLanguage(...args: Parameters<Edit['setCodeBlockLanguage']>) { return this.edit.setCodeBlockLanguage(...args) }
}

export default Ast
