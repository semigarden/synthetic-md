import AST from "./ast"
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
        
        const parentBlock = this.ast.getParentBlock(context.block)

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

        const list = this.ast.getListForMarkerMerge(context.block)
        if (list) {
            return {
                preventDefault: true,
                ast: [{ type: 'mergeMarker', blockId: list.id }],
            }
        }

        const previousInline = this.ast.getPreviousInline(context.inline.id)
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

    public apply(effect: EditEffect) {
        if (effect.ast) {
            effect.ast.forEach(effect => {
                const effectTypes = ['input', 'splitBlock', 'splitListItem', 'mergeInline', 'mergeMarker']
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
                        case 'mergeMarker':
                            result = this.ast.mergeMarker(effect.blockId)
                            break
                    }
                    if (!result) return

                    const { renderEffect, caretEffect } = result

                    this.ast.updateAST()
                    this.render.apply(renderEffect)
                    this.caret.apply(caretEffect)
                    this.emitChange()
                }
            })
        }
    }
}

export default Editor
