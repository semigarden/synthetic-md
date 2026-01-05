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
        if (intent === 'enter') {
            return this.onEnter(context)
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

    public onEnter(context: EditContext): EditEffect {
        console.log('enter')
        const caretPosition = this.caret.getPositionInInline(context.inlineElement)
        const blocks = this.ast.ast.blocks
        const flattenedBlocks = this.flattenBlocks(blocks)
        const blockIndex = flattenedBlocks.findIndex(b => b.id === context.block.id)

        console.log('blockIndex', blockIndex, 'context.block.id', context.block.id, 'blocks', JSON.stringify(blocks, null, 2))
        if (blockIndex === -1) return { preventDefault: true }

        console.log('caretPosition', caretPosition)

        if (context.inlineIndex === 0 && caretPosition === 0) {
            console.log('enter at start of block')

            const parentBlock = this.getParentBlock(context.block)
            if (parentBlock) {
                if (parentBlock.type === 'listItem') {
                    console.log('list item block', JSON.stringify(parentBlock, null, 2))

                    const listItemBlock = parentBlock
                    const listBlock = this.getParentBlock(parentBlock)
                    if (listBlock && listBlock.type === 'list') {
                        const newListItemBlock = {
                            id: uuid(),
                            type: 'listItem',
                            text: listItemBlock.text.slice(0, -context.block.text.length),
                            position: listItemBlock.position,
                            blocks: [],
                            inlines: [],
                        } as ListItem

                        const newParagraphBlock = {
                            id: uuid(),
                            type: 'paragraph',
                            text: context.block.text,
                            position: { start: context.block.position.start, end: context.block.position.end },
                            inlines: [],
                        } as Block

                        const newParagraphInline = {
                            id: uuid(),
                            type: 'text',
                            text: { symbolic: context.inline.text.symbolic, semantic: context.inline.text.semantic },
                            position: { start: context.inline.position.start, end: context.inline.position.start + context.inline.text.symbolic.length },
                        } as Inline

                        newParagraphBlock.inlines.push(newParagraphInline)

                        newListItemBlock.blocks.push(newParagraphBlock)

                        context.block.text = ''
                        context.block.inlines[0].text = { symbolic: '', semantic: '' }
                        context.block.position = { start: context.block.position.start, end: context.block.position.start }

                        console.log('newListItemBlock', JSON.stringify(newListItemBlock, null, 2))

                        const index = listBlock.blocks.findIndex(b => b.id === listItemBlock.id)
                        // this.engine.ast.blocks.splice(listBlockIndex, 1, listBlock)
                        listBlock.blocks.splice(index + 1, 0, newListItemBlock)

                        renderBlock(newListItemBlock, this.rootElement, null, listItemBlock)

                        this.caret.setInlineId(newParagraphInline.id)
                        this.caret.setBlockId(newParagraphBlock.id)
                        this.caret.setPosition(0)

                        this.ast.updateAST()
                        this.caret?.restoreCaret()
                        this.emitChange()

                        return { preventDefault: true }
                        
                    }
                }
            }

            const emptyInline: Inline = {
                id: uuid(),
                type: 'text',
                blockId: context.block.id,
                text: { symbolic: '', semantic: '' },
                position: { start: 0, end: 0 }
            }

            const inlines = context.block.inlines
            const text = inlines.map((i: Inline) => i.text.symbolic).join('')

            const newBlock: Block = {
                id: uuid(),
                type: context.block.type,
                text: text,
                inlines,
                position: { start: context.block.position.start, end: context.block.position.start + text.length }
            } as Block

            for (const inline of newBlock.inlines) {
                inline.blockId = newBlock.id
            }

            context.block.text = ''
            context.block.inlines = [emptyInline]
            context.block.position = { start: context.block.position.start, end: context.block.position.start }

            blocks.splice(blockIndex + 1, 0, newBlock)

            const targetInline = newBlock.inlines[0]

            // console.log('newBlock', JSON.stringify(newBlock, null, 2))
            // console.log('targetInline', JSON.stringify(ctx.block, null, 2))

            this.caret.setInlineId(targetInline.id)
            this.caret.setBlockId(targetInline.blockId)
            this.caret.setPosition(0)

            renderBlock(context.block, this.rootElement)
            renderBlock(newBlock, this.rootElement, null, context.block)

            this.ast.updateAST()

            requestAnimationFrame(() => {
                this.caret?.restoreCaret()
            })

            this.emitChange()

            // console.log('ast', JSON.stringify(this.engine.ast, null, 2))

            return { preventDefault: true }
        }

        const parentBlock = this.getParentBlock(context.block)
        if (parentBlock) {
            if (parentBlock.type === 'listItem') {
                console.log('list item block', JSON.stringify(parentBlock, null, 2))

                const listItem = parentBlock
                const list = this.getParentBlock(parentBlock)
                if (list && list.type === 'list') {
                    const text = context.inline.text.symbolic

                    const beforeText = text.slice(0, caretPosition)
                    const afterText = text.slice(caretPosition)

                    const beforeInlines = parseInlineContent(beforeText, context.block.id, context.inline.position.start)
                    const afterInlines = parseInlineContent(afterText, context.block.id, context.inline.position.start + beforeText.length)

                    const newParagraphInlines = afterInlines.concat(context.block.inlines.slice(context.inlineIndex + 1))
                    context.block.inlines.splice(context.inlineIndex, context.block.inlines.length - context.inlineIndex, ...beforeInlines)

                    const newListItem = {
                        id: uuid(),
                        type: 'listItem',
                        text: listItem.text.slice(0, -context.block.text.length),
                        position: listItem.position,
                        blocks: [],
                        inlines: [],
                    } as ListItem

                    const newParagraphText = newParagraphInlines.map(i => i.text.symbolic).join('')
                    const newParagraph = {
                        id: uuid(),
                        type: context.block.type,
                        text: newParagraphText,
                        inlines: newParagraphInlines,
                        position: { start: context.block.position.end, end: context.block.position.end + newParagraphText.length }
                    } as Block

                    if (newParagraphInlines.length === 0) {
                        newParagraphInlines.push({
                            id: uuid(),
                            type: 'text',
                            blockId: newParagraph.id,
                            text: { symbolic: '', semantic: '' },
                            position: { start: 0, end: 0 }
                        })
                    }

                    newListItem.blocks.push(newParagraph)

                    for (const inline of newParagraphInlines) {
                        inline.blockId = newParagraph.id
                    }

                    const index = list.blocks.findIndex(b => b.id === listItem.id)
                    list.blocks.splice(index + 1, 0, newListItem)


                    const caretAtEnd = caretPosition === text.length

                    let targetInline: Inline
                    let targetOffset: number

                    if (caretAtEnd && newParagraph.inlines.length === 0) {
                        targetInline = beforeInlines[beforeInlines.length - 1]
                        targetOffset = targetInline.text.symbolic.length
                    } else if (caretAtEnd) {
                        targetInline = newParagraph.inlines[0]
                        targetOffset = 0
                    } else {
                        targetInline = newParagraph.inlines[0]
                        targetOffset = 0
                    }
            
                    if (targetInline) {
                        this.caret.setInlineId(targetInline.id)
                        this.caret.setBlockId(targetInline.blockId)
                        this.caret.setPosition(targetOffset)
                    }

                    const selection = window.getSelection();
                    if (selection && selection.rangeCount > 0) {
                        const range = selection.getRangeAt(0);
                        if (range.startContainer.nodeType === Node.ELEMENT_NODE) {
                            const el = range.startContainer as HTMLElement;
                            if (el.firstChild?.nodeName === 'BR') {
                                el.removeChild(el.firstChild);
                            }
                        }
                    }

                    renderBlock(context.block, this.rootElement)
                    renderBlock(newListItem, this.rootElement, null, listItem)

                    this.ast.updateAST()
                    this.caret?.restoreCaret()
                    this.emitChange()

                    return { preventDefault: true }
                }
            }
        }

        const text = context.inline.text.symbolic

        const beforeText = text.slice(0, caretPosition)
        const afterText = text.slice(caretPosition)

        const beforeInlines = parseInlineContent(beforeText, context.block.id, context.inline.position.start)
        const afterInlines = parseInlineContent(afterText, context.block.id, context.inline.position.start + beforeText.length)

        const newBlockInlines = afterInlines.concat(context.block.inlines.slice(context.inlineIndex + 1))
        context.block.inlines.splice(context.inlineIndex, context.block.inlines.length - context.inlineIndex, ...beforeInlines)

        const newBlockText = newBlockInlines.map(i => i.text.symbolic).join('')
        const newBlock = {
            id: uuid(),
            type: context.block.type,
            text: newBlockText,
            inlines: newBlockInlines,
            position: { start: context.block.position.end, end: context.block.position.end + newBlockText.length }
        } as Block

        if (newBlockInlines.length === 0) {
            newBlockInlines.push({
                id: uuid(),
                type: 'text',
                blockId: newBlock.id,
                text: { symbolic: '', semantic: '' },
                position: { start: 0, end: 0 }
            })
        }

        for (const inline of newBlockInlines) {
            inline.blockId = newBlock.id
        }

        blocks.splice(blockIndex + 1, 0, newBlock)

        const caretAtEnd = caretPosition === text.length

        let targetInline: Inline
        let targetOffset: number

        if (caretAtEnd && newBlock.inlines.length === 0) {
            targetInline = beforeInlines[beforeInlines.length - 1]
            targetOffset = targetInline.text.symbolic.length
        } else if (caretAtEnd) {
            targetInline = newBlock.inlines[0]
            targetOffset = 0
        } else {
            targetInline = newBlock.inlines[0]
            targetOffset = 0
        }
 
        if (targetInline) {
            this.caret.setInlineId(targetInline.id)
            this.caret.setBlockId(targetInline.blockId)
            this.caret.setPosition(targetOffset)
        }

        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            if (range.startContainer.nodeType === Node.ELEMENT_NODE) {
                const el = range.startContainer as HTMLElement;
                if (el.firstChild?.nodeName === 'BR') {
                    el.removeChild(el.firstChild);
                }
            }
        }

        renderBlock(context.block, this.rootElement)
        renderBlock(newBlock, this.rootElement, null, context.block)

        this.ast.updateAST()
        this.caret?.restoreCaret()
        this.emitChange()

        // console.log('ast', JSON.stringify(this.engine.ast, null, 2))

        // console.log(`inline ${ctx.inline.id} split: ${ctx.inline.text.symbolic} > ${ctx.inlineEl.textContent ?? ''}`)

        return { preventDefault: true }
    }

    private findPreviousInline(context: EditContext): Inline | null {
        const flattenedInlines = this.ast.flattenInlines(this.ast.ast.blocks)
        const inlineIndex = flattenedInlines.findIndex(i => i.id === context.inline.id)
        if (inlineIndex === -1) return null

        return flattenedInlines[inlineIndex - 1]
    }

    private resolveMerge(context: EditContext): EditEffect {
        console.log('merge')
        const caretPosition = this.caret.getPositionInInline(context.inlineElement)

        if (caretPosition !== 0) return { preventDefault: false }

        const previousInline = this.findPreviousInline(context)

        if (!previousInline) return { preventDefault: false }

        return {
            preventDefault: true,
            ast: [{
                type: 'mergeInline',
                leftInlineId: previousInline.id,
                rightInlineId: context.inline.id,
            }],
            caret: {
                moveToEndOfPreviousInline: true,
            }
        }

        // const flattenedBlocks = this.flattenBlocks(this.ast.ast.blocks)

        // if (context.inlineIndex === 0 && caretPosition === 0) {
        //     console.log('merge at start of block')
            
        //     const blockIndex = flattenedBlocks.findIndex(b => b.id === context.block.id)
        //     if (blockIndex === -1 || blockIndex === 0) return { preventDefault: true }

        //     const parentBlock = this.getParentBlock(context.block)
        //     if (parentBlock) {
        //         if (parentBlock.type === 'listItem') {
        //             const listItemBlock = parentBlock
        //             const list = this.getParentBlock(parentBlock)
        //             if (list && list.type === 'list') {
        //                 // console.log('list', JSON.stringify(listBlock, null, 2))
        //                 const listBlockIndex = this.ast.ast.blocks.findIndex(b => b.id === list.id)
        //                 const listItemBlockIndex = flattenedBlocks.findIndex(b => b.id === listItemBlock.id)
        //                 const listItemIndex = list.blocks.findIndex(b => b.id === listItemBlock.id)

        //                 if (listItemIndex === 0) {
        //                     const newText = listItemBlock.text.slice(0, 1) + listItemBlock.text.slice(2, -1)
        //                     console.log('newText', JSON.stringify(newText, null, 2))
        //                     const detectedBlockType = this.detectBlockType(newText)
        //                     if (detectedBlockType.type !== listItemBlock.type) {
                                
        //                         if (list.blocks.length === 1) {
        //                             const listBlockEl = this.rootElement.querySelector(`[data-block-id="${list.id}"]`)
        //                             if (listBlockEl) {
        //                                 listBlockEl.remove()
        //                             }
    
        //                             const newBlock = {
        //                                 id: uuid(),
        //                                 type: detectedBlockType.type,
        //                                 text: newText,
        //                                 inlines: [],
        //                                 position: { start: listItemBlock.position.start, end: listItemBlock.position.start + newText.length }
        //                             } as Block
    
        //                             const newBlockInlines = parseInlineContent(newText, newBlock.id, newBlock.position.start)
    
        //                             newBlock.inlines = newBlockInlines

        //                             this.ast.ast.blocks.splice(listBlockIndex, 1, newBlock)

        //                             const prevBlock = this.ast.ast.blocks[listBlockIndex - 1]

        //                             console.log('list', JSON.stringify(newBlock, null, 2))
        //                             renderBlock(newBlock, this.rootElement, null, prevBlock)

        //                             this.caret.setInlineId(newBlockInlines[0].id)
        //                             this.caret.setBlockId(newBlock.id)
        //                             this.caret.setPosition(1)

        //                             this.ast.updateAST()
        //                             this.caret?.restoreCaret()
        //                             this.emitChange()

        //                             return { preventDefault: true }
        //                         }
        //                     }
        //                 }

        //                 if (listItemIndex > 0) {
        //                     const prevListItem = list.blocks[listItemIndex - 1] as ListItem
        //                     const prevListItemParagraph = prevListItem.blocks[0]

        //                     const prevLastInlineIndex = prevListItemParagraph.inlines.length - 1
        //                     const targetPosition = prevListItemParagraph.inlines[prevLastInlineIndex].position.end

        //                     const prevText = prevListItemParagraph.inlines
        //                         .map((i: Inline) => i.text.symbolic)
        //                         .join('')

        //                     const currText = context.block.inlines
        //                         .map((i: Inline) => i.text.symbolic)
        //                         .join('')

        //                     const mergedText = prevText + currText

        //                     const newInlines = parseInlineContent(
        //                         mergedText,
        //                         prevListItemParagraph.id,
        //                         prevListItemParagraph.position.start
        //                     )

        //                     if (newInlines.length === 0) {
        //                         newInlines.push({
        //                             id: uuid(),
        //                             type: 'text',
        //                             blockId: prevListItemParagraph.id,
        //                             text: { symbolic: '', semantic: '' },
        //                             position: { start: 0, end: 0 }
        //                         })
        //                     }

        //                     prevListItemParagraph.text = mergedText
        //                     prevListItemParagraph.inlines = newInlines


        //                     const index = list.blocks.findIndex(b => b.id === listItemBlock.id)

        //                     list.blocks.splice(index, 1)

        //                     let targetInlineIndex: number
        //                     if (context.inline.type === prevListItemParagraph.inlines[prevLastInlineIndex].type && context.inline.type === 'text') {
        //                         targetInlineIndex = prevLastInlineIndex
        //                     } else {
        //                         targetInlineIndex = prevLastInlineIndex + 1
        //                     }
        //                     const targetInline = newInlines[targetInlineIndex]

        //                     this.caret.setInlineId(targetInline.id)
        //                     this.caret.setBlockId(targetInline.blockId)
        //                     this.caret.setPosition(targetPosition)

        //                     renderBlock(prevListItemParagraph, this.rootElement)

        //                     const blockEl = this.rootElement.querySelector(`[data-block-id="${listItemBlock.id}"]`)
        //                     if (blockEl) {
        //                         blockEl.remove()
        //                     }

        //                     this.ast.updateAST()

        //                     requestAnimationFrame(() => {
        //                         this.caret?.restoreCaret()
        //                     })

        //                     this.emitChange()

        //                     return { preventDefault: true }
        //                 }
        //             }
        //         }
        //     }

        //     const prevBlock = flattenedBlocks[blockIndex - 1]

        //     const prevLastInlineIndex = prevBlock.inlines.length - 1
        //     const targetPosition = prevBlock.inlines[prevLastInlineIndex].position.end
        //     console.log('targetPosition', targetPosition)

        //     const prevText = prevBlock.inlines
        //         .map((i: Inline) => i.text.symbolic)
        //         .join('')

        //     const currText = context.block.inlines
        //         .map((i: Inline) => i.text.symbolic)
        //         .join('')

        //     const mergedText = prevText + currText

        //     const newInlines = parseInlineContent(
        //         mergedText,
        //         prevBlock.id,
        //         prevBlock.position.start
        //     )

        //     if (newInlines.length === 0) {
        //         newInlines.push({
        //             id: uuid(),
        //             type: 'text',
        //             blockId: prevBlock.id,
        //             text: { symbolic: '', semantic: '' },
        //             position: { start: 0, end: 0 }
        //         })
        //     }

        //     prevBlock.text = mergedText
        //     prevBlock.inlines = newInlines


        //     const index = this.ast.ast.blocks.findIndex(b => b.id === context.block.id)

        //     this.ast.ast.blocks.splice(index, 1)

        //     let targetInlineIndex: number
        //     if (context.inline.type === prevBlock.inlines[prevLastInlineIndex].type && context.inline.type === 'text') {
        //         targetInlineIndex = prevLastInlineIndex
        //     } else {
        //         targetInlineIndex = prevLastInlineIndex + 1
        //     }
        //     const targetInline = newInlines[targetInlineIndex]

        //     this.caret.setInlineId(targetInline.id)
        //     this.caret.setBlockId(targetInline.blockId)
        //     this.caret.setPosition(targetPosition)

        //     renderBlock(prevBlock, this.rootElement)

        //     const blockEl = this.rootElement.querySelector(`[data-block-id="${context.block.id}"]`)
        //     if (blockEl) {
        //         blockEl.remove()
        //     }

        //     this.ast.updateAST()

        //     requestAnimationFrame(() => {
        //         this.caret?.restoreCaret()
        //     })

        //     this.emitChange()

        //     return { preventDefault: true }
        // }

        // console.log('context.block.inlines', JSON.stringify(context.block.inlines, null, 2))

        // const previousInline = context.block.inlines[context.inlineIndex - 1]

        // const currentBlockText = context.block.inlines.map((i: Inline) => {
        //     if (i.id === previousInline.id && previousInline.text.symbolic.length > 0) {
        //         return i.text.symbolic.slice(0, -1)
        //     }
        //     return i.text.symbolic
        // }).join('')

        // const newInlines = parseInlineContent(currentBlockText, context.block.id, previousInline.position.end - 1)

        // context.block.inlines = newInlines

        // console.log('newInlines', JSON.stringify(newInlines, null, 2))

        // const targetInline = newInlines[context.inlineIndex - 1]

        // this.caret.setInlineId(targetInline.id)
        // this.caret.setBlockId(targetInline.blockId)
        // this.caret.setPosition(targetInline.position.end)

        // renderBlock(context.block, this.rootElement)

        // this.ast.updateAST()
        // this.caret?.restoreCaret()
        // this.emitChange()

        return { preventDefault: true }
    }

    // private merge(context: EditContext): EditEffect {
    //     console.log('merge')
    //     const caretPosition = this.caret.getPositionInInline(context.inlineElement)

    //     if (caretPosition !== 0) return { preventDefault: false }

    //     const flattenedBlocks = this.flattenBlocks(this.ast.ast.blocks)

    //     if (context.inlineIndex === 0 && caretPosition === 0) {
    //         console.log('merge at start of block')

    //         return {
    //             preventDefault: true,
    //             ast: [{
    //                 type: 'mergeInlineWithPrevious',
    //                 inlineId: context.inline.id,
    //             }],
    //             caret: {
    //                 moveToEndOfPreviousInline: true,
    //             }
    //         }
            
    //     //     const blockIndex = flattenedBlocks.findIndex(b => b.id === context.block.id)
    //     //     if (blockIndex === -1 || blockIndex === 0) return { preventDefault: true }

    //     //     const parentBlock = this.getParentBlock(context.block)
    //     //     if (parentBlock) {
    //     //         if (parentBlock.type === 'listItem') {
    //     //             const listItemBlock = parentBlock
    //     //             const list = this.getParentBlock(parentBlock)
    //     //             if (list && list.type === 'list') {
    //     //                 // console.log('list', JSON.stringify(listBlock, null, 2))
    //     //                 const listBlockIndex = this.ast.ast.blocks.findIndex(b => b.id === list.id)
    //     //                 const listItemBlockIndex = flattenedBlocks.findIndex(b => b.id === listItemBlock.id)
    //     //                 const listItemIndex = list.blocks.findIndex(b => b.id === listItemBlock.id)

    //     //                 if (listItemIndex === 0) {
    //     //                     const newText = listItemBlock.text.slice(0, 1) + listItemBlock.text.slice(2, -1)
    //     //                     console.log('newText', JSON.stringify(newText, null, 2))
    //     //                     const detectedBlockType = this.detectBlockType(newText)
    //     //                     if (detectedBlockType.type !== listItemBlock.type) {
                                
    //     //                         if (list.blocks.length === 1) {
    //     //                             const listBlockEl = this.rootElement.querySelector(`[data-block-id="${list.id}"]`)
    //     //                             if (listBlockEl) {
    //     //                                 listBlockEl.remove()
    //     //                             }
    
    //     //                             const newBlock = {
    //     //                                 id: uuid(),
    //     //                                 type: detectedBlockType.type,
    //     //                                 text: newText,
    //     //                                 inlines: [],
    //     //                                 position: { start: listItemBlock.position.start, end: listItemBlock.position.start + newText.length }
    //     //                             } as Block
    
    //     //                             const newBlockInlines = parseInlineContent(newText, newBlock.id, newBlock.position.start)
    
    //     //                             newBlock.inlines = newBlockInlines

    //     //                             this.ast.ast.blocks.splice(listBlockIndex, 1, newBlock)

    //     //                             const prevBlock = this.ast.ast.blocks[listBlockIndex - 1]

    //     //                             console.log('list', JSON.stringify(newBlock, null, 2))
    //     //                             renderBlock(newBlock, this.rootElement, null, prevBlock)

    //     //                             this.caret.setInlineId(newBlockInlines[0].id)
    //     //                             this.caret.setBlockId(newBlock.id)
    //     //                             this.caret.setPosition(1)

    //     //                             this.ast.updateAST()
    //     //                             this.caret?.restoreCaret()
    //     //                             this.emitChange()

    //     //                             return { preventDefault: true }
    //     //                         }
    //     //                     }
    //     //                 }

    //     //                 if (listItemIndex > 0) {
    //     //                     const prevListItem = list.blocks[listItemIndex - 1] as ListItem
    //     //                     const prevListItemParagraph = prevListItem.blocks[0]

    //     //                     const prevLastInlineIndex = prevListItemParagraph.inlines.length - 1
    //     //                     const targetPosition = prevListItemParagraph.inlines[prevLastInlineIndex].position.end

    //     //                     const prevText = prevListItemParagraph.inlines
    //     //                         .map((i: Inline) => i.text.symbolic)
    //     //                         .join('')

    //     //                     const currText = context.block.inlines
    //     //                         .map((i: Inline) => i.text.symbolic)
    //     //                         .join('')

    //     //                     const mergedText = prevText + currText

    //     //                     const newInlines = parseInlineContent(
    //     //                         mergedText,
    //     //                         prevListItemParagraph.id,
    //     //                         prevListItemParagraph.position.start
    //     //                     )

    //     //                     if (newInlines.length === 0) {
    //     //                         newInlines.push({
    //     //                             id: uuid(),
    //     //                             type: 'text',
    //     //                             blockId: prevListItemParagraph.id,
    //     //                             text: { symbolic: '', semantic: '' },
    //     //                             position: { start: 0, end: 0 }
    //     //                         })
    //     //                     }

    //     //                     prevListItemParagraph.text = mergedText
    //     //                     prevListItemParagraph.inlines = newInlines


    //     //                     const index = list.blocks.findIndex(b => b.id === listItemBlock.id)

    //     //                     list.blocks.splice(index, 1)

    //     //                     let targetInlineIndex: number
    //     //                     if (context.inline.type === prevListItemParagraph.inlines[prevLastInlineIndex].type && context.inline.type === 'text') {
    //     //                         targetInlineIndex = prevLastInlineIndex
    //     //                     } else {
    //     //                         targetInlineIndex = prevLastInlineIndex + 1
    //     //                     }
    //     //                     const targetInline = newInlines[targetInlineIndex]

    //     //                     this.caret.setInlineId(targetInline.id)
    //     //                     this.caret.setBlockId(targetInline.blockId)
    //     //                     this.caret.setPosition(targetPosition)

    //     //                     renderBlock(prevListItemParagraph, this.rootElement)

    //     //                     const blockEl = this.rootElement.querySelector(`[data-block-id="${listItemBlock.id}"]`)
    //     //                     if (blockEl) {
    //     //                         blockEl.remove()
    //     //                     }

    //     //                     this.ast.updateAST()

    //     //                     requestAnimationFrame(() => {
    //     //                         this.caret?.restoreCaret()
    //     //                     })

    //     //                     this.emitChange()

    //     //                     return { preventDefault: true }
    //     //                 }
    //     //             }
    //     //         }
    //     //     }

    //     //     const prevBlock = flattenedBlocks[blockIndex - 1]

    //     //     const prevLastInlineIndex = prevBlock.inlines.length - 1
    //     //     const targetPosition = prevBlock.inlines[prevLastInlineIndex].position.end
    //     //     console.log('targetPosition', targetPosition)

    //     //     const prevText = prevBlock.inlines
    //     //         .map((i: Inline) => i.text.symbolic)
    //     //         .join('')

    //     //     const currText = context.block.inlines
    //     //         .map((i: Inline) => i.text.symbolic)
    //     //         .join('')

    //     //     const mergedText = prevText + currText

    //     //     const newInlines = parseInlineContent(
    //     //         mergedText,
    //     //         prevBlock.id,
    //     //         prevBlock.position.start
    //     //     )

    //     //     if (newInlines.length === 0) {
    //     //         newInlines.push({
    //     //             id: uuid(),
    //     //             type: 'text',
    //     //             blockId: prevBlock.id,
    //     //             text: { symbolic: '', semantic: '' },
    //     //             position: { start: 0, end: 0 }
    //     //         })
    //     //     }

    //     //     prevBlock.text = mergedText
    //     //     prevBlock.inlines = newInlines


    //     //     const index = this.ast.ast.blocks.findIndex(b => b.id === context.block.id)

    //     //     this.ast.ast.blocks.splice(index, 1)

    //     //     let targetInlineIndex: number
    //     //     if (context.inline.type === prevBlock.inlines[prevLastInlineIndex].type && context.inline.type === 'text') {
    //     //         targetInlineIndex = prevLastInlineIndex
    //     //     } else {
    //     //         targetInlineIndex = prevLastInlineIndex + 1
    //     //     }
    //     //     const targetInline = newInlines[targetInlineIndex]

    //     //     this.caret.setInlineId(targetInline.id)
    //     //     this.caret.setBlockId(targetInline.blockId)
    //     //     this.caret.setPosition(targetPosition)

    //     //     renderBlock(prevBlock, this.rootElement)

    //     //     const blockEl = this.rootElement.querySelector(`[data-block-id="${context.block.id}"]`)
    //     //     if (blockEl) {
    //     //         blockEl.remove()
    //     //     }

    //     //     this.ast.updateAST()

    //     //     requestAnimationFrame(() => {
    //     //         this.caret?.restoreCaret()
    //     //     })

    //     //     this.emitChange()

    //     //     return { preventDefault: true }
    //     }

    //     console.log('context.block.inlines', JSON.stringify(context.block.inlines, null, 2))

    //     const previousInline = context.block.inlines[context.inlineIndex - 1]

    //     const currentBlockText = context.block.inlines.map((i: Inline) => {
    //         if (i.id === previousInline.id && previousInline.text.symbolic.length > 0) {
    //             return i.text.symbolic.slice(0, -1)
    //         }
    //         return i.text.symbolic
    //     }).join('')

    //     const newInlines = parseInlineContent(currentBlockText, context.block.id, previousInline.position.end - 1)

    //     context.block.inlines = newInlines

    //     console.log('newInlines', JSON.stringify(newInlines, null, 2))

    //     const targetInline = newInlines[context.inlineIndex - 1]

    //     this.caret.setInlineId(targetInline.id)
    //     this.caret.setBlockId(targetInline.blockId)
    //     this.caret.setPosition(targetInline.position.end)

    //     renderBlock(context.block, this.rootElement)

    //     this.ast.updateAST()
    //     this.caret?.restoreCaret()
    //     this.emitChange()

    //     return { preventDefault: true }
    // }

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
        const flattenedBlocks = this.flattenBlocks(this.ast.ast.blocks)
        const blockIndex = flattenedBlocks.findIndex(b => b.id === block.id)

        const newBlock = buildBlocks(text, this.ast.ast)[0]

        const oldBlockEl = this.rootElement.querySelector(`[data-block-id="${block.id}"]`)
        if (oldBlockEl) {
            oldBlockEl.remove()
        }

        if (newBlock.type === 'list') {
            const nestedBlocks = this.flattenBlocks(newBlock.blocks)
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
                    renderBlock(newBlock, this.rootElement, null, prevBlock)
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
            renderBlock(newBlock, this.rootElement, null, prevBlock)
        } else {
            renderBlock(newBlock, this.rootElement)
        }

        this.ast.updateAST()
        this.caret?.restoreCaret()
        this.emitChange()
    }

    private getParentBlock(block: Block): Block | null {
        const flattenedBlocks = this.flattenBlocks(this.ast.ast.blocks)
        const parentBlock = flattenedBlocks.find(b => b.type === 'list' && b.blocks?.some(b => b.id === block.id)) ?? flattenedBlocks.find(b => b.type === 'listItem' && b.blocks?.some(b => b.id === block.id))
        return parentBlock ?? null
    }

    private flattenBlocks(blocks: Block[], acc: Block[] = []): Block[] {
        for (const b of blocks) {
          acc.push(b)
          if ('blocks' in b && b.blocks) this.flattenBlocks(b.blocks, acc)
        }
        return acc
    }

    public apply(effect: EditEffect) {
        if (effect.ast) {
            effect.ast.forEach(effect => {
                if (effect.type === 'mergeInline') {
                    const result = this.ast.mergeInline(effect.leftInlineId, effect.rightInlineId)
                    if (!result) return

                    const { targetBlocks, targetInline, targetPosition } = result

                    for (const block of targetBlocks) {
                        renderBlock(block, this.rootElement)

                        const blockEl = this.rootElement.querySelector(`[data-block-id="${block.id}"]`)
                        if (block.inlines.length === 0 && blockEl) blockEl.remove()
                    }

                    this.ast.updateAST()

                    this.caret.setInlineId(targetInline.id)
                    this.caret.setBlockId(targetInline.blockId)
                    this.caret.setPosition(targetPosition)
                    this.caret.restoreCaret()

                    this.emitChange()

                    return { preventDefault: true }
                }
            })
        }
        if (effect.caret) this.caret.apply(effect.caret)
    }
}

export default Editor
