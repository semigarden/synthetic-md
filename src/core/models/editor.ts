import AST from "./ast"
import Caret from "./caret"
import { EditContext, EditEffect, Intent, Block, Inline, ListItem, AstApplyEffect } from "../types"
import { parseInlineContent, detectType, buildBlocks } from "../ast/ast"
import { uuid } from "../utils/utils"
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

    public onInput(context: EditContext) {
        console.log('onInput')

        console.log('ctx', context.inlineElement.textContent)
        const newText = context.inlineElement.textContent ?? ''
        const detectedBlockType = detectType(newText)

        const blockTypeChanged =
            detectedBlockType.type !== context.block.type ||
            (detectedBlockType.type === 'heading' && context.block.type === 'heading' && detectedBlockType.level !== context.block.level)
        
        const ignoreTypes = ['blankLine', 'heading', 'thematicBreak', 'codeBlock']
        if (blockTypeChanged && !ignoreTypes.includes(detectedBlockType.type)) {
            console.log('block type changed', detectedBlockType.type, context.block.type)
            this.transformBlock(context.block, newText, detectedBlockType.type)
            return
        }

        const caretOffset = this.caret.getPositionInInline(context.inlineElement)
        const result = this.normalizeTextContext({
            inline: context.inline,
            block: context.block,
            inlineIndex: context.inlineIndex,
            value: context.inlineElement.textContent ?? '',
            caretOffset
        })

        this.applyInlineNormalization(context.block, result)
    
        renderBlock(context.block, this.rootElement, result.caretInline?.id ?? null)

        // console.log(`inline ${context.inline.id} changed: ${context.inline.text.symbolic} > ${context.inlineElement.textContent ?? ''}`)

        
        this.ast.updateAST()
        this.caret?.restoreCaret()
        this.emitChange()

        // console.log('ast', JSON.stringify(this.engine.ast, null, 2))

    }

    public resolveSplit(context: EditContext): EditEffect {
        console.log('split')
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

        const list = this.getListForMarkerMerge(context.block)
        if (list) {
            return {
                preventDefault: true,
                ast: [{ type: 'mergeMarker', blockId: list.id }],
            }
        }

        const previousInline = this.findPreviousInline(context)
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

    private findPreviousInline(context: EditContext): Inline | null {
        const flattenedInlines = this.ast.flattenInlines(this.ast.ast.blocks)
        const inlineIndex = flattenedInlines.findIndex(i => i.id === context.inline.id)
        if (inlineIndex === -1) return null

        return flattenedInlines[inlineIndex - 1]
    }

    private getListForMarkerMerge(block: Block): Block | null {
        let current: Block | null = block
    
        while (true) {
            const parent = this.ast.getParentBlock(current)
            if (!parent) return null
    
            if (parent.type === 'listItem') {
                current = parent
                continue
            }
    
            if (parent.type === 'list' && parent.blocks[0]?.id === current.id) {
                return parent
            }
    
            return null
        }
    }

    private normalizeTextContext(params: {
        inline: Inline
        block: Block
        inlineIndex: number
        value: string
        caretOffset: number
    }): {
        contextStart: number
        contextEnd: number
        oldInlines: Inline[]
        newInlines: Inline[]
        caretInline: Inline | null
        caretPosition: number
    } {
        const { inline, block, inlineIndex, value, caretOffset } = params
    
        let contextStart = inlineIndex
        let contextEnd = inlineIndex + 1
    
        while (contextStart > 0 && block.inlines[contextStart - 1].type === 'text') {
            contextStart--
        }
    
        while (contextEnd < block.inlines.length && block.inlines[contextEnd].type === 'text') {
            contextEnd++
        }
    
        const oldInlines = block.inlines.slice(contextStart, contextEnd)
    
        let contextText = ''
        for (const i of oldInlines) {
            contextText += i.id === inline.id ? value : i.text.symbolic
        }
    
        const position = block.inlines[contextStart].position.start
        const newInlines = parseInlineContent(contextText, inline.blockId, position)
    
        const caretPositionInContext =
            this.caret.getPositionInInlines(oldInlines, inline.id, caretOffset)
    
        let caretInline: Inline | null = null
        let caretPosition = 0
        let acc = 0
    
        for (const ni of newInlines) {
            const len = ni.text?.symbolic.length ?? 0
            if (acc + len >= caretPositionInContext) {
                caretInline = ni
                caretPosition = caretPositionInContext - acc
                break
            }
            acc += len
        }
    
        if (!caretInline && newInlines.length) {
            const last = newInlines[newInlines.length - 1]
            caretInline = last
            caretPosition = last.text.symbolic.length
        }

        if (!caretInline && newInlines.length === 0) {
            const prevInline = block.inlines[inlineIndex - 1]
            if (prevInline) {
                caretInline = prevInline
                caretPosition = prevInline.text.symbolic.length
            } else {
                newInlines.push({
                    id: uuid(),
                    type: 'text',
                    blockId: block.id,
                    text: { symbolic: '', semantic: '' },
                    position: { start: 0, end: 0 }
                })
                caretInline = newInlines[0]
                caretPosition = 0
            }
        }

        return {
            contextStart,
            contextEnd,
            oldInlines,
            newInlines,
            caretInline,
            caretPosition
        }
    }

    private applyInlineNormalization(
        block: Block,
        result: {
            contextStart: number
            contextEnd: number
            newInlines: Inline[]
            caretInline: Inline | null
            caretPosition: number
        }
    ) {
        const {
            contextStart,
            contextEnd,
            newInlines,
            caretInline,
            caretPosition
        } = result
    
        block.inlines.splice(
            contextStart,
            contextEnd - contextStart,
            ...newInlines
        )
    
        if (caretInline) {
            this.caret.setInlineId(caretInline.id)
            this.caret.setBlockId(caretInline.blockId)
            this.caret.setPosition(caretPosition)
        }
    }

    private transformBlock(block: Block, text: string, type: Block["type"]) {
        const flattenedBlocks = this.ast.flattenBlocks(this.ast.ast.blocks)
        const blockIndex = flattenedBlocks.findIndex(b => b.id === block.id)

        const newBlock = buildBlocks(text, this.ast.ast)[0]

        const oldBlockEl = this.rootElement.querySelector(`[data-block-id="${block.id}"]`)
        if (oldBlockEl) {
            oldBlockEl.remove()
        }

        if (newBlock.type === 'list') {
            const nestedBlocks = this.ast.flattenBlocks(newBlock.blocks)
            const lastNestedBlock = nestedBlocks.at(-1)

            if (lastNestedBlock) {
                const lastNestedInline = lastNestedBlock?.inlines.at(-1)
                if (lastNestedInline) {
                    this.caret.setInlineId(lastNestedInline.id)
                    this.caret.setBlockId(lastNestedBlock.id)
                    this.caret.setPosition(lastNestedInline.text.symbolic.length + 1)
                    this.caret?.restoreCaret()
                }

                this.ast.ast.blocks.splice(blockIndex, 1, newBlock)

                const prevBlock = this.ast.ast.blocks[blockIndex - 1]
                if (prevBlock) {
                    renderBlock(newBlock, this.rootElement, null, 'next', prevBlock)
                } else {
                    renderBlock(newBlock, this.rootElement)
                }

                this.ast.updateAST()
                this.caret?.restoreCaret()
                this.emitChange()
            
                return
            }
        }

        this.ast.ast.blocks.splice(blockIndex, 1, newBlock)

        const prevBlock = this.ast.ast.blocks[blockIndex - 1]
        if (prevBlock) {
            renderBlock(newBlock, this.rootElement, null, 'next', prevBlock)
        } else {
            renderBlock(newBlock, this.rootElement)
        }

        this.ast.updateAST()
        this.caret?.restoreCaret()
        this.emitChange()
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

    public apply(effect: EditEffect) {
        if (effect.ast) {
            effect.ast.forEach(effect => {
                const effectTypes = ['splitBlock', 'splitListItem', 'mergeInline', 'mergeMarker']
                if (effectTypes.includes(effect.type)) {
                    let result: AstApplyEffect | null = null
                    switch (effect.type) {
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
}

export default Editor
