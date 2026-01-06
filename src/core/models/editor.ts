import AST from "./ast"
import Caret from "./caret"
import { EditContext, EditEffect, AstApplyEffect, Intent, Block } from "../types"
import { renderBlock } from "../render/renderBlock"

class Editor {
    private emitChange: () => void

    constructor(
        private rootElement: HTMLElement,
        private caret: Caret,
        private ast: AST,
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

                    const { render, caret } = result

                    render.remove.forEach(block => {
                        const removeBlockElement = this.rootElement.querySelector(`[data-block-id="${block.id}"]`)
                        if (removeBlockElement) removeBlockElement.remove()
                    })

                    render.insert.forEach(render => {
                        renderBlock(render.current, this.rootElement, null, render.at, render.target)
                    })

                    this.removeEmptyBlocks(render.insert.map(render => render.current))

                    this.ast.updateAST()

                    this.caret.setInlineId(caret.inlineId)
                    this.caret.setBlockId(caret.blockId)
                    this.caret.setPosition(caret.position)
                    this.caret.restoreCaret()

                    this.emitChange()
                }
            })
        }
        if (effect.caret) this.caret.apply(effect.caret)
    }

    private removeEmptyBlocks(blocks: Block[]) {
        for (const block of blocks) {
            const hasContent =
                block.inlines.length > 0 ||
                ('blocks' in block && block.blocks.some(b => b.inlines.length > 0 || ('blocks' in b && b.blocks.length > 0)))
    
            if (!hasContent) {
                const blockEl = this.rootElement!.querySelector(`[data-block-id="${block.id}"]`)
                if (blockEl) blockEl.remove()
    
                const parentBlock = this.ast.getParentBlock(block)
                if (parentBlock && 'blocks' in parentBlock) {
                    const idx = parentBlock.blocks.findIndex(b => b.id === block.id)
                    if (idx !== -1) parentBlock.blocks.splice(idx, 1)
                } else {
                    const idx = this.ast.ast.blocks.findIndex(b => b.id === block.id)
                    if (idx !== -1) this.ast.ast.blocks.splice(idx, 1)
                }

                if (parentBlock) {
                    this.removeEmptyBlocks([parentBlock])
                }
            }
        }
    }
}

export default Editor
