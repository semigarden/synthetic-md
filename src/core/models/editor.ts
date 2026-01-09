import AST from "./ast/ast"
import Caret from "./caret"
import Render from "./render"
import { EditContext, EditEffect, AstApplyEffect, Intent } from "../types"

class Editor {
    private emitChange: () => void

    constructor(
        private ast: AST,
        private caret: Caret,
        private render: Render,
        emitChange: () => void
    ) {
        this.emitChange = emitChange
    }

    public onIntent(intent: Intent, context: EditContext): EditEffect {
        if (intent === 'split') {
            return this.resolveSplit(context)
        } else if (intent === 'merge') {
            return this.resolveMerge(context)
        } else if (intent === 'indent') {
            return this.resolveIndent(context)
        } else if (intent === 'outdent') {
            return this.resolveOutdent(context)
        }

        return { preventDefault: false }
    }

    public resolveInput(context: EditContext): EditEffect {
        const caretPosition = this.caret.getPositionInInline(context.inlineElement)

        return {
            preventDefault: false,
            ast: [{
                type: 'input',
                blockId: context.block.id,
                inlineId: context.inline.id,
                text: context.inlineElement.textContent ?? '',
                caretPosition: caretPosition,
            }],
        }
    }

    public resolveSplit(context: EditContext): EditEffect {
        const caretPosition = this.caret.getPositionInInline(context.inlineElement)
        
        const parentBlock = this.ast.query.getParentBlock(context.block)

        if (parentBlock?.type === 'listItem') {
            return {
                preventDefault: true,
                ast: [{
                    type: 'splitListItem',
                    listItemId: parentBlock.id,
                    blockId: context.block.id,
                    inlineId: context.inline.id,
                    caretPosition: caretPosition,
                }],
            }
        }

        return {
            preventDefault: true,
            ast: [{
                type: 'splitBlock',
                blockId: context.block.id,
                inlineId: context.inline.id,
                caretPosition: caretPosition,
            }],
        }
    }

    private resolveMerge(context: EditContext): EditEffect {
        if (this.caret.getPositionInInline(context.inlineElement) !== 0) return { preventDefault: false }

        const listItem = this.ast.query.getParentBlock(context.block)
        if (listItem?.type === 'listItem') {
            const list = this.ast.query.getListFromBlock(listItem)
            if (list) {
                const itemIndex = list.blocks.indexOf(listItem)
                const isFirstItem = itemIndex === 0

                const parentOfList = this.ast.query.getParentBlock(list)
                const isNestedList = parentOfList?.type === 'listItem'
                
                if (isFirstItem && isNestedList) {
                    return {
                        preventDefault: true,
                        ast: [{ type: 'outdentListItem', listItemId: listItem.id }],
                    }
                }
            }
        }

        const list = this.ast.query.getListFromBlock(context.block)
        const previousInline = list && list.blocks.length > 1 ? this.ast.query.getPreviousInlineInList(context.inline) ?? this.ast.query.getPreviousInline(context.inline.id) : this.ast.query.getPreviousInline(context.inline.id)

        if (previousInline) {
            return {
                preventDefault: true,
                ast: [{
                    type: 'mergeInline',
                    leftInlineId: previousInline.id,
                    rightInlineId: context.inline.id,
                }],
            }
        }

        return { preventDefault: false }
    }

    private resolveIndent(context: EditContext): EditEffect {
        const listItem = this.ast.query.getParentBlock(context.block)
        if (!listItem || listItem.type !== 'listItem') return { preventDefault: false }

        return {
            preventDefault: true,
            ast: [{ type: 'indentListItem', listItemId: listItem.id }],
        }
    }

    private resolveOutdent(context: EditContext): EditEffect {
        const listItem = this.ast.query.getParentBlock(context.block)
        if (!listItem || listItem.type !== 'listItem') return { preventDefault: false }

        return {
            preventDefault: true,
            ast: [{ type: 'outdentListItem', listItemId: listItem.id }],
        }
    }

    public apply(effect: EditEffect) {
        if (effect.ast) {
            effect.ast.forEach(effect => {
                const effectTypes = ['input', 'splitBlock', 'splitListItem', 'mergeInline', 'indentListItem', 'outdentListItem']
                if (effectTypes.includes(effect.type)) {
                    let result: AstApplyEffect | null = null
                    switch (effect.type) {
                        case 'input':
                            result = this.ast.input(effect.blockId, effect.inlineId, effect.text, effect.caretPosition)
                            break
                        case 'splitBlock':
                            result = this.ast.split(effect.blockId, effect.inlineId, effect.caretPosition)
                            break
                        case 'splitListItem':
                            result = this.ast.splitListItem(effect.listItemId, effect.blockId, effect.inlineId, effect.caretPosition)
                            break
                        case 'mergeInline':
                            result = this.ast.mergeInline(effect.leftInlineId, effect.rightInlineId)
                            break
                        case 'indentListItem':
                            result = this.ast.indentListItem(effect.listItemId)
                            break
                        case 'outdentListItem':
                            result = this.ast.outdentListItem(effect.listItemId)
                            break
                    }
                    if (!result) return

                    const { renderEffect, caretEffect } = result

                    this.ast.normalize()
                    this.render.apply(renderEffect)
                    this.caret.apply(caretEffect)
                    this.emitChange()
                }
            })
        }
    }
}

export default Editor
