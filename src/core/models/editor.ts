import AST from "./ast"
import Caret from "./caret"
import { EditContext, EditEffect, Intent, Block, Inline, ListItem } from "../types"
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
        const detectedBlockType = this.detectBlockType(newText)

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

    // public resolveSplit(context: EditContext): EditEffect {
    //     console.log('split')
    //     const caretPosition = this.caret.getPositionInInline(context.inlineElement)
    //     const blocks = this.ast.ast.blocks
    //     const flattenedBlocks = this.ast.flattenBlocks(blocks)
    //     const blockIndex = flattenedBlocks.findIndex(b => b.id === context.block.id)

    //     console.log('blockIndex', blockIndex, 'context.block.id', context.block.id, 'blocks', JSON.stringify(blocks, null, 2))
    //     if (blockIndex === -1) return { preventDefault: true }

    //     console.log('caretPosition', caretPosition)

    //     if (context.inlineIndex === 0 && caretPosition === 0) {
    //         console.log('enter at start of block')

    //         const parentBlock = this.ast.getParentBlock(context.block)
    //         if (parentBlock) {
    //             if (parentBlock.type === 'listItem') {
    //                 console.log('list item block', JSON.stringify(parentBlock, null, 2))

    //                 const listItemBlock = parentBlock
    //                 const listBlock = this.ast.getParentBlock(parentBlock)
    //                 if (listBlock && listBlock.type === 'list') {
    //                     const newListItemBlock = {
    //                         id: uuid(),
    //                         type: 'listItem',
    //                         text: listItemBlock.text.slice(0, -context.block.text.length),
    //                         position: listItemBlock.position,
    //                         blocks: [],
    //                         inlines: [],
    //                     } as ListItem

    //                     const newParagraphBlock = {
    //                         id: uuid(),
    //                         type: 'paragraph',
    //                         text: context.block.text,
    //                         position: { start: context.block.position.start, end: context.block.position.end },
    //                         inlines: [],
    //                     } as Block

    //                     const newParagraphInline = {
    //                         id: uuid(),
    //                         type: 'text',
    //                         text: { symbolic: context.inline.text.symbolic, semantic: context.inline.text.semantic },
    //                         position: { start: context.inline.position.start, end: context.inline.position.start + context.inline.text.symbolic.length },
    //                     } as Inline

    //                     newParagraphBlock.inlines.push(newParagraphInline)

    //                     newListItemBlock.blocks.push(newParagraphBlock)

    //                     context.block.text = ''
    //                     context.block.inlines[0].text = { symbolic: '', semantic: '' }
    //                     context.block.position = { start: context.block.position.start, end: context.block.position.start }

    //                     console.log('newListItemBlock', JSON.stringify(newListItemBlock, null, 2))

    //                     const index = listBlock.blocks.findIndex(b => b.id === listItemBlock.id)
    //                     // this.engine.ast.blocks.splice(listBlockIndex, 1, listBlock)
    //                     listBlock.blocks.splice(index + 1, 0, newListItemBlock)

    //                     renderBlock(newListItemBlock, this.rootElement, null, 'next', listItemBlock)

    //                     this.caret.setInlineId(newParagraphInline.id)
    //                     this.caret.setBlockId(newParagraphBlock.id)
    //                     this.caret.setPosition(0)

    //                     this.ast.updateAST()
    //                     this.caret?.restoreCaret()
    //                     this.emitChange()

    //                     return { preventDefault: true }
                        
    //                 }
    //             }
    //         }

    //         const emptyInline: Inline = {
    //             id: uuid(),
    //             type: 'text',
    //             blockId: context.block.id,
    //             text: { symbolic: '', semantic: '' },
    //             position: { start: 0, end: 0 }
    //         }

    //         const inlines = context.block.inlines
    //         const text = inlines.map((i: Inline) => i.text.symbolic).join('')

    //         const newBlock: Block = {
    //             id: uuid(),
    //             type: context.block.type,
    //             text: text,
    //             inlines,
    //             position: { start: context.block.position.start, end: context.block.position.start + text.length }
    //         } as Block

    //         for (const inline of newBlock.inlines) {
    //             inline.blockId = newBlock.id
    //         }

    //         context.block.text = ''
    //         context.block.inlines = [emptyInline]
    //         context.block.position = { start: context.block.position.start, end: context.block.position.start }

    //         blocks.splice(blockIndex + 1, 0, newBlock)

    //         const targetInline = newBlock.inlines[0]

    //         // console.log('newBlock', JSON.stringify(newBlock, null, 2))
    //         // console.log('targetInline', JSON.stringify(ctx.block, null, 2))

    //         this.caret.setInlineId(targetInline.id)
    //         this.caret.setBlockId(targetInline.blockId)
    //         this.caret.setPosition(0)

    //         renderBlock(context.block, this.rootElement)
    //         renderBlock(newBlock, this.rootElement, null, 'next', context.block)

    //         this.ast.updateAST()

    //         requestAnimationFrame(() => {
    //             this.caret?.restoreCaret()
    //         })

    //         this.emitChange()

    //         // console.log('ast', JSON.stringify(this.engine.ast, null, 2))

    //         return { preventDefault: true }
    //     }

    //     const parentBlock = this.ast.getParentBlock(context.block)
    //     if (parentBlock) {
    //         if (parentBlock.type === 'listItem') {
    //             console.log('list item block', JSON.stringify(parentBlock, null, 2))

    //             const listItem = parentBlock
    //             const list = this.ast.getParentBlock(parentBlock)
    //             if (list && list.type === 'list') {
    //                 const text = context.inline.text.symbolic

    //                 const beforeText = text.slice(0, caretPosition)
    //                 const afterText = text.slice(caretPosition)

    //                 const beforeInlines = parseInlineContent(beforeText, context.block.id, context.inline.position.start)
    //                 const afterInlines = parseInlineContent(afterText, context.block.id, context.inline.position.start + beforeText.length)

    //                 const newParagraphInlines = afterInlines.concat(context.block.inlines.slice(context.inlineIndex + 1))
    //                 context.block.inlines.splice(context.inlineIndex, context.block.inlines.length - context.inlineIndex, ...beforeInlines)

    //                 const newListItem = {
    //                     id: uuid(),
    //                     type: 'listItem',
    //                     text: listItem.text.slice(0, -context.block.text.length),
    //                     position: listItem.position,
    //                     blocks: [],
    //                     inlines: [],
    //                 } as ListItem

    //                 const newParagraphText = newParagraphInlines.map(i => i.text.symbolic).join('')
    //                 const newParagraph = {
    //                     id: uuid(),
    //                     type: context.block.type,
    //                     text: newParagraphText,
    //                     inlines: newParagraphInlines,
    //                     position: { start: context.block.position.end, end: context.block.position.end + newParagraphText.length }
    //                 } as Block

    //                 if (newParagraphInlines.length === 0) {
    //                     newParagraphInlines.push({
    //                         id: uuid(),
    //                         type: 'text',
    //                         blockId: newParagraph.id,
    //                         text: { symbolic: '', semantic: '' },
    //                         position: { start: 0, end: 0 }
    //                     })
    //                 }

    //                 newListItem.blocks.push(newParagraph)

    //                 for (const inline of newParagraphInlines) {
    //                     inline.blockId = newParagraph.id
    //                 }

    //                 const index = list.blocks.findIndex(b => b.id === listItem.id)
    //                 list.blocks.splice(index + 1, 0, newListItem)


    //                 const caretAtEnd = caretPosition === text.length

    //                 let targetInline: Inline
    //                 let targetOffset: number

    //                 if (caretAtEnd && newParagraph.inlines.length === 0) {
    //                     targetInline = beforeInlines[beforeInlines.length - 1]
    //                     targetOffset = targetInline.text.symbolic.length
    //                 } else if (caretAtEnd) {
    //                     targetInline = newParagraph.inlines[0]
    //                     targetOffset = 0
    //                 } else {
    //                     targetInline = newParagraph.inlines[0]
    //                     targetOffset = 0
    //                 }
            
    //                 if (targetInline) {
    //                     this.caret.setInlineId(targetInline.id)
    //                     this.caret.setBlockId(targetInline.blockId)
    //                     this.caret.setPosition(targetOffset)
    //                 }

    //                 const selection = window.getSelection();
    //                 if (selection && selection.rangeCount > 0) {
    //                     const range = selection.getRangeAt(0);
    //                     if (range.startContainer.nodeType === Node.ELEMENT_NODE) {
    //                         const el = range.startContainer as HTMLElement;
    //                         if (el.firstChild?.nodeName === 'BR') {
    //                             el.removeChild(el.firstChild);
    //                         }
    //                     }
    //                 }

    //                 renderBlock(context.block, this.rootElement)
    //                 renderBlock(newListItem, this.rootElement, null, 'next', listItem)

    //                 this.ast.updateAST()
    //                 this.caret?.restoreCaret()
    //                 this.emitChange()

    //                 return { preventDefault: true }
    //             }
    //         }
    //     }

    //     const text = context.inline.text.symbolic

    //     const beforeText = text.slice(0, caretPosition)
    //     const afterText = text.slice(caretPosition)

    //     const beforeInlines = parseInlineContent(beforeText, context.block.id, context.inline.position.start)
    //     const afterInlines = parseInlineContent(afterText, context.block.id, context.inline.position.start + beforeText.length)

    //     const newBlockInlines = afterInlines.concat(context.block.inlines.slice(context.inlineIndex + 1))
    //     context.block.inlines.splice(context.inlineIndex, context.block.inlines.length - context.inlineIndex, ...beforeInlines)

    //     const newBlockText = newBlockInlines.map(i => i.text.symbolic).join('')
    //     const newBlock = {
    //         id: uuid(),
    //         type: context.block.type,
    //         text: newBlockText,
    //         inlines: newBlockInlines,
    //         position: { start: context.block.position.end, end: context.block.position.end + newBlockText.length }
    //     } as Block

    //     if (newBlockInlines.length === 0) {
    //         newBlockInlines.push({
    //             id: uuid(),
    //             type: 'text',
    //             blockId: newBlock.id,
    //             text: { symbolic: '', semantic: '' },
    //             position: { start: 0, end: 0 }
    //         })
    //     }

    //     for (const inline of newBlockInlines) {
    //         inline.blockId = newBlock.id
    //     }

    //     blocks.splice(blockIndex + 1, 0, newBlock)

    //     const caretAtEnd = caretPosition === text.length

    //     let targetInline: Inline
    //     let targetOffset: number

    //     if (caretAtEnd && newBlock.inlines.length === 0) {
    //         targetInline = beforeInlines[beforeInlines.length - 1]
    //         targetOffset = targetInline.text.symbolic.length
    //     } else if (caretAtEnd) {
    //         targetInline = newBlock.inlines[0]
    //         targetOffset = 0
    //     } else {
    //         targetInline = newBlock.inlines[0]
    //         targetOffset = 0
    //     }
 
    //     if (targetInline) {
    //         this.caret.setInlineId(targetInline.id)
    //         this.caret.setBlockId(targetInline.blockId)
    //         this.caret.setPosition(targetOffset)
    //     }

    //     const selection = window.getSelection();
    //     if (selection && selection.rangeCount > 0) {
    //         const range = selection.getRangeAt(0);
    //         if (range.startContainer.nodeType === Node.ELEMENT_NODE) {
    //             const el = range.startContainer as HTMLElement;
    //             if (el.firstChild?.nodeName === 'BR') {
    //                 el.removeChild(el.firstChild);
    //             }
    //         }
    //     }

    //     renderBlock(context.block, this.rootElement)
    //     renderBlock(newBlock, this.rootElement, null, 'next', context.block)

    //     this.ast.updateAST()
    //     this.caret?.restoreCaret()
    //     this.emitChange()

    //     // console.log('ast', JSON.stringify(this.engine.ast, null, 2))

    //     // console.log(`inline ${ctx.inline.id} split: ${ctx.inline.text.symbolic} > ${ctx.inlineEl.textContent ?? ''}`)

    //     return { preventDefault: true }
    // }

    public resolveSplit(context: EditContext): EditEffect {
        console.log('split')
        return {
            preventDefault: true,
            ast: [{
                type: 'split',
                blockId: context.block.id,
                inlineId: context.inline.id,
                caretPosition: this.caret.getPositionInInline(context.inlineElement),
            }],
        }
    }

    private getSplitType(context: EditContext): 'listItem' | 'none' {
        const parentBlock = this.ast.getParentBlock(context.block)
        if (parentBlock?.type === 'listItem') {
            return 'listItem'
        }
        return 'none'
    }

    private findPreviousInline(context: EditContext): Inline | null {
        const flattenedInlines = this.ast.flattenInlines(this.ast.ast.blocks)
        const inlineIndex = flattenedInlines.findIndex(i => i.id === context.inline.id)
        if (inlineIndex === -1) return null

        return flattenedInlines[inlineIndex - 1]
    }

    private resolveMerge(context: EditContext): EditEffect {
        switch (this.getMergeType(context)) {
            case 'marker':
                const getRootParentBlock = (block: Block) => {
                    let parentBlock = this.ast.getParentBlock(block)
                    if (parentBlock?.type === 'listItem') {
                        return getRootParentBlock(parentBlock)
                    }
                    return parentBlock
                }

                const rootParentBlock = getRootParentBlock(context.block)
                if (rootParentBlock?.type === 'list') {
                    return {
                        preventDefault: true,
                        ast: [{ type: 'mergeMarker', blockId: rootParentBlock.id }],
                    }
                }

                return { preventDefault: false }

            case 'inline':
                const previousInline = this.findPreviousInline(context)!
                return {
                    preventDefault: true,
                    ast: [{
                        type: 'mergeInline',
                        leftInlineId: previousInline.id,
                        rightInlineId: context.inline.id,
                    }],
                }

            default:
                return { preventDefault: false }
        }
    }

    private getMergeType(context: EditContext): 'marker' | 'inline' | 'none' {
        if (this.caret.getPositionInInline(context.inlineElement) !== 0) return 'none'
    
        const block = this.ast.getBlockById(context.block.id)
        if (!block) return 'none'
    
        const parent = this.ast.getParentBlock(block)
        if (parent?.type === 'listItem') {
            const list = this.ast.getParentBlock(parent)
            if (list?.type === 'list' && list.blocks[0]?.id === parent.id) {
                return 'marker'
            }
        }
    
        return this.findPreviousInline(context) ? 'inline' : 'none'
    }

    private detectBlockType(text: string) {
        return detectType(text)
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
                if (effect.type === 'split') {
                    const result = this.ast.split(effect.blockId, effect.inlineId, effect.caretPosition)
                    if (!result) return

                    const { targetBlocks, targetInline, targetPosition } = result
                }

                if (effect.type === 'mergeInline') {
                    const result = this.ast.mergeInline(effect.leftInlineId, effect.rightInlineId)
                    if (!result) return

                    const { targetBlocks, targetInline, targetPosition } = result

                    for (const block of targetBlocks) {
                        renderBlock(block, this.rootElement)
                    }

                    this.removeEmptyBlocks(targetBlocks)
                    this.ast.updateAST()

                    this.caret.setInlineId(targetInline.id)
                    this.caret.setBlockId(targetInline.blockId)
                    this.caret.setPosition(targetPosition)
                    this.caret.restoreCaret()

                    this.emitChange()
                }

                if (effect.type === 'mergeMarker') {
                    const result = this.ast.mergeMarker(effect.blockId)
                    if (!result) return

                    const { render, caret } = result

                    if (render.remove) {
                        const removeBlockElement = this.rootElement.querySelector(`[data-block-id="${render.remove.id}"]`)
                        if (removeBlockElement) removeBlockElement.remove()
                    }
            
                    renderBlock(render.insert.current, this.rootElement, null, render.insert.at, render.insert.target)

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
