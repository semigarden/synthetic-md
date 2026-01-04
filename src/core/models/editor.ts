import AST from "./ast"
import Caret from "./caret"
import { Block, Inline, ListItem } from "../ast/types"
import { parseInlineContent, detectType, buildBlocks } from "../ast/ast"
import { uuid } from "../utils/utils"
import { renderBlock } from "../render/renderBlock"

class Editor {
    private ast: AST
    private caret: Caret
    private root: HTMLElement
    private emitChange: () => void
    private isEditing: boolean

    constructor(ast: AST, caret: Caret, root: HTMLElement, emitChange: () => void ) {
        this.ast = ast
        this.caret = caret
        this.root = root
        this.emitChange = emitChange
        this.isEditing = false
    }

    public onInput(e: Event) {
        console.log('onInput')
        const ctx = this.resolveInlineContext()
        if (!ctx) return

        this.isEditing = true;

        console.log('ctx', ctx.inlineEl.textContent)
        const newText = ctx.inlineEl.textContent ?? ''
        const detectedBlockType = this.detectBlockType(newText)

        const blockTypeChanged =
            detectedBlockType.type !== ctx.block.type ||
            (detectedBlockType.type === 'heading' && ctx.block.type === 'heading' && detectedBlockType.level !== ctx.block.level)
        
        const ignoreTypes = ['blankLine', 'heading', 'thematicBreak', 'codeBlock']
        if (blockTypeChanged && !ignoreTypes.includes(detectedBlockType.type)) {
            console.log('block type changed', detectedBlockType.type, ctx.block.type)
            this.transformBlock(ctx.block, newText, detectedBlockType.type)
            return
        }

        const caretOffset = this.caret.getPositionInInline(ctx.inlineEl)
        const result = this.normalizeTextContext({
            inline: ctx.inline,
            block: ctx.block,
            inlineIndex: ctx.inlineIndex,
            value: ctx.inlineEl.textContent ?? '',
            caretOffset
        })

        this.applyInlineNormalization(ctx.block, result)
    
        renderBlock(ctx.block, this.root, result.caretInline?.id ?? null)

        // console.log(`inline ${ctx.inline.id} changed: ${ctx.inline.text.symbolic} > ${ctx.inlineEl.textContent ?? ''}`)

        
        this.updateAST()
        this.caret?.restoreCaret()
        this.emitChange()

        // console.log('ast', JSON.stringify(this.engine.ast, null, 2))

        this.isEditing = false;
    }

    public onEnter(e: KeyboardEvent) {
        console.log('enter')
        // const ctx = this.resolveInlineContext(e)
        const ctx = this.resolveInlineContext()
        if (!ctx) return

        this.isEditing = true

        e.preventDefault()

        const caretPosition = this.caret.getPositionInInline(ctx.inlineEl)
        const blocks = this.ast.ast.blocks
        const flattenedBlocks = this.flattenBlocks(blocks)
        const blockIndex = flattenedBlocks.findIndex(b => b.id === ctx.block.id)

        console.log('blockIndex', blockIndex, 'ctx.block.id', ctx.block.id, 'blocks', JSON.stringify(blocks, null, 2))
        if (blockIndex === -1) return

        console.log('caretPosition', caretPosition)

        if (ctx.inlineIndex === 0 && caretPosition === 0) {
            console.log('enter at start of block')

            const parentBlock = this.getParentBlock(ctx.block)
            if (parentBlock) {
                if (parentBlock.type === 'listItem') {
                    console.log('list item block', JSON.stringify(parentBlock, null, 2))

                    const listItemBlock = parentBlock
                    const listBlock = this.getParentBlock(parentBlock)
                    if (listBlock && listBlock.type === 'list') {
                        const newListItemBlock = {
                            id: uuid(),
                            type: 'listItem',
                            text: listItemBlock.text.slice(0, -ctx.block.text.length),
                            position: listItemBlock.position,
                            blocks: [],
                            inlines: [],
                        } as ListItem

                        const newParagraphBlock = {
                            id: uuid(),
                            type: 'paragraph',
                            text: ctx.block.text,
                            position: { start: ctx.block.position.start, end: ctx.block.position.end },
                            inlines: [],
                        } as Block

                        const newParagraphInline = {
                            id: uuid(),
                            type: 'text',
                            text: { symbolic: ctx.inline.text.symbolic, semantic: ctx.inline.text.semantic },
                            position: { start: ctx.inline.position.start, end: ctx.inline.position.start + ctx.inline.text.symbolic.length },
                        } as Inline

                        newParagraphBlock.inlines.push(newParagraphInline)

                        newListItemBlock.blocks.push(newParagraphBlock)

                        ctx.block.text = ''
                        ctx.block.inlines[0].text = { symbolic: '', semantic: '' }
                        ctx.block.position = { start: ctx.block.position.start, end: ctx.block.position.start }

                        console.log('newListItemBlock', JSON.stringify(newListItemBlock, null, 2))

                        const index = listBlock.blocks.findIndex(b => b.id === listItemBlock.id)
                        // this.engine.ast.blocks.splice(listBlockIndex, 1, listBlock)
                        listBlock.blocks.splice(index + 1, 0, newListItemBlock)

                        renderBlock(newListItemBlock, this.root, null, listItemBlock)

                        this.caret.setInlineId(newParagraphInline.id)
                        this.caret.setBlockId(newParagraphBlock.id)
                        this.caret.setPosition(0)

                        this.updateAST()
                        this.caret?.restoreCaret()
                        this.emitChange()

                        this.isEditing = false
                        return
                        
                    }
                }
            }

            const emptyInline: Inline = {
                id: uuid(),
                type: 'text',
                blockId: ctx.block.id,
                text: { symbolic: '', semantic: '' },
                position: { start: 0, end: 0 }
            }

            const inlines = ctx.block.inlines
            const text = inlines.map((i: Inline) => i.text.symbolic).join('')

            const newBlock: Block = {
                id: uuid(),
                type: ctx.block.type,
                text: text,
                inlines,
                position: { start: ctx.block.position.start, end: ctx.block.position.start + text.length }
            } as Block

            for (const inline of newBlock.inlines) {
                inline.blockId = newBlock.id
            }

            ctx.block.text = ''
            ctx.block.inlines = [emptyInline]
            ctx.block.position = { start: ctx.block.position.start, end: ctx.block.position.start }

            blocks.splice(blockIndex + 1, 0, newBlock)

            const targetInline = newBlock.inlines[0]

            // console.log('newBlock', JSON.stringify(newBlock, null, 2))
            // console.log('targetInline', JSON.stringify(ctx.block, null, 2))

            this.caret.setInlineId(targetInline.id)
            this.caret.setBlockId(targetInline.blockId)
            this.caret.setPosition(0)

            renderBlock(ctx.block, this.root)
            renderBlock(newBlock, this.root, null, ctx.block)

            this.updateAST()

            requestAnimationFrame(() => {
                this.caret?.restoreCaret()
            })

            this.emitChange()

            // console.log('ast', JSON.stringify(this.engine.ast, null, 2))

            this.isEditing = false
            return
        }

        const parentBlock = this.getParentBlock(ctx.block)
        if (parentBlock) {
            if (parentBlock.type === 'listItem') {
                console.log('list item block', JSON.stringify(parentBlock, null, 2))

                const listItem = parentBlock
                const list = this.getParentBlock(parentBlock)
                if (list && list.type === 'list') {
                    const text = ctx.inline.text.symbolic

                    const beforeText = text.slice(0, caretPosition)
                    const afterText = text.slice(caretPosition)

                    const beforeInlines = parseInlineContent(beforeText, ctx.block.id, ctx.inline.position.start)
                    const afterInlines = parseInlineContent(afterText, ctx.block.id, ctx.inline.position.start + beforeText.length)

                    const newParagraphInlines = afterInlines.concat(ctx.block.inlines.slice(ctx.inlineIndex + 1))
                    ctx.block.inlines.splice(ctx.inlineIndex, ctx.block.inlines.length - ctx.inlineIndex, ...beforeInlines)

                    const newListItem = {
                        id: uuid(),
                        type: 'listItem',
                        text: listItem.text.slice(0, -ctx.block.text.length),
                        position: listItem.position,
                        blocks: [],
                        inlines: [],
                    } as ListItem

                    const newParagraphText = newParagraphInlines.map(i => i.text.symbolic).join('')
                    const newParagraph = {
                        id: uuid(),
                        type: ctx.block.type,
                        text: newParagraphText,
                        inlines: newParagraphInlines,
                        position: { start: ctx.block.position.end, end: ctx.block.position.end + newParagraphText.length }
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

                    renderBlock(ctx.block, this.root)
                    renderBlock(newListItem, this.root, null, listItem)

                    this.updateAST()
                    this.caret?.restoreCaret()
                    this.emitChange()

                    this.isEditing = false
                    return
                }
            }
        }

        const text = ctx.inline.text.symbolic

        const beforeText = text.slice(0, caretPosition)
        const afterText = text.slice(caretPosition)

        const beforeInlines = parseInlineContent(beforeText, ctx.block.id, ctx.inline.position.start)
        const afterInlines = parseInlineContent(afterText, ctx.block.id, ctx.inline.position.start + beforeText.length)

        const newBlockInlines = afterInlines.concat(ctx.block.inlines.slice(ctx.inlineIndex + 1))
        ctx.block.inlines.splice(ctx.inlineIndex, ctx.block.inlines.length - ctx.inlineIndex, ...beforeInlines)

        const newBlockText = newBlockInlines.map(i => i.text.symbolic).join('')
        const newBlock = {
            id: uuid(),
            type: ctx.block.type,
            text: newBlockText,
            inlines: newBlockInlines,
            position: { start: ctx.block.position.end, end: ctx.block.position.end + newBlockText.length }
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

        renderBlock(ctx.block, this.root)
        renderBlock(newBlock, this.root, null, ctx.block)

        this.updateAST()
        this.caret?.restoreCaret()
        this.emitChange()

        // console.log('ast', JSON.stringify(this.engine.ast, null, 2))

        // console.log(`inline ${ctx.inline.id} split: ${ctx.inline.text.symbolic} > ${ctx.inlineEl.textContent ?? ''}`)

        this.isEditing = false
    }

    public onBackspace(e: KeyboardEvent) {
        console.log('backspace')
        // const ctx = this.resolveInlineContext(e)
        const ctx = this.resolveInlineContext()
        if (!ctx) return

        this.isEditing = true

        const caretPosition = this.caret.getPositionInInline(ctx.inlineEl)

        if (caretPosition !== 0) {
            this.isEditing = false
            return
        }

        e.preventDefault()

        const flattenedBlocks = this.flattenBlocks(this.ast.ast.blocks)

        if (ctx.inlineIndex === 0 && caretPosition === 0) {
            console.log('backspace at start of block')
            
            const blockIndex = flattenedBlocks.findIndex(b => b.id === ctx.block.id)
            if (blockIndex === -1 || blockIndex === 0) return

            const parentBlock = this.getParentBlock(ctx.block)
            if (parentBlock) {
                if (parentBlock.type === 'listItem') {
                    const listItemBlock = parentBlock
                    const list = this.getParentBlock(parentBlock)
                    if (list && list.type === 'list') {
                        // console.log('list', JSON.stringify(listBlock, null, 2))
                        const listBlockIndex = this.ast.ast.blocks.findIndex(b => b.id === list.id)
                        const listItemBlockIndex = flattenedBlocks.findIndex(b => b.id === listItemBlock.id)
                        const listItemIndex = list.blocks.findIndex(b => b.id === listItemBlock.id)

                        if (listItemIndex === 0) {
                            const newText = listItemBlock.text.slice(0, 1) + listItemBlock.text.slice(2, -1)
                            console.log('newText', JSON.stringify(newText, null, 2))
                            const detectedBlockType = this.detectBlockType(newText)
                            if (detectedBlockType.type !== listItemBlock.type) {
                                
                                if (list.blocks.length === 1) {
                                    const listBlockEl = this.root.querySelector(`[data-block-id="${list.id}"]`)
                                    if (listBlockEl) {
                                        listBlockEl.remove()
                                    }
    
                                    const newBlock = {
                                        id: uuid(),
                                        type: detectedBlockType.type,
                                        text: newText,
                                        inlines: [],
                                        position: { start: listItemBlock.position.start, end: listItemBlock.position.start + newText.length }
                                    } as Block
    
                                    const newBlockInlines = parseInlineContent(newText, newBlock.id, newBlock.position.start)
    
                                    newBlock.inlines = newBlockInlines

                                    this.ast.ast.blocks.splice(listBlockIndex, 1, newBlock)

                                    const prevBlock = this.ast.ast.blocks[listBlockIndex - 1]

                                    console.log('list', JSON.stringify(newBlock, null, 2))
                                    renderBlock(newBlock, this.root, null, prevBlock)

                                    this.caret.setInlineId(newBlockInlines[0].id)
                                    this.caret.setBlockId(newBlock.id)
                                    this.caret.setPosition(1)

                                    this.updateAST()
                                    this.caret?.restoreCaret()
                                    this.emitChange()

                                    this.isEditing = false
                                    return
                                }
                            }
                        }

                        if (listItemIndex > 0) {
                            const prevListItem = list.blocks[listItemIndex - 1] as ListItem
                            const prevListItemParagraph = prevListItem.blocks[0]

                            const prevLastInlineIndex = prevListItemParagraph.inlines.length - 1
                            const targetPosition = prevListItemParagraph.inlines[prevLastInlineIndex].position.end

                            const prevText = prevListItemParagraph.inlines
                                .map((i: Inline) => i.text.symbolic)
                                .join('')

                            const currText = ctx.block.inlines
                                .map((i: Inline) => i.text.symbolic)
                                .join('')

                            const mergedText = prevText + currText

                            const newInlines = parseInlineContent(
                                mergedText,
                                prevListItemParagraph.id,
                                prevListItemParagraph.position.start
                            )

                            if (newInlines.length === 0) {
                                newInlines.push({
                                    id: uuid(),
                                    type: 'text',
                                    blockId: prevListItemParagraph.id,
                                    text: { symbolic: '', semantic: '' },
                                    position: { start: 0, end: 0 }
                                })
                            }

                            prevListItemParagraph.text = mergedText
                            prevListItemParagraph.inlines = newInlines


                            const index = list.blocks.findIndex(b => b.id === listItemBlock.id)

                            list.blocks.splice(index, 1)

                            let targetInlineIndex: number
                            if (ctx.inline.type === prevListItemParagraph.inlines[prevLastInlineIndex].type && ctx.inline.type === 'text') {
                                targetInlineIndex = prevLastInlineIndex
                            } else {
                                targetInlineIndex = prevLastInlineIndex + 1
                            }
                            const targetInline = newInlines[targetInlineIndex]

                            this.caret.setInlineId(targetInline.id)
                            this.caret.setBlockId(targetInline.blockId)
                            this.caret.setPosition(targetPosition)

                            renderBlock(prevListItemParagraph, this.root)

                            const blockEl = this.root.querySelector(`[data-block-id="${listItemBlock.id}"]`)
                            if (blockEl) {
                                blockEl.remove()
                            }

                            this.updateAST()

                            requestAnimationFrame(() => {
                                this.caret?.restoreCaret()
                            })

                            this.emitChange()

                            this.isEditing = false
                            return
                        }
                    }
                }
            }

            const prevBlock = flattenedBlocks[blockIndex - 1]

            const prevLastInlineIndex = prevBlock.inlines.length - 1
            const targetPosition = prevBlock.inlines[prevLastInlineIndex].position.end
            console.log('targetPosition', targetPosition)

            const prevText = prevBlock.inlines
                .map((i: Inline) => i.text.symbolic)
                .join('')

            const currText = ctx.block.inlines
                .map((i: Inline) => i.text.symbolic)
                .join('')

            const mergedText = prevText + currText

            const newInlines = parseInlineContent(
                mergedText,
                prevBlock.id,
                prevBlock.position.start
            )

            if (newInlines.length === 0) {
                newInlines.push({
                    id: uuid(),
                    type: 'text',
                    blockId: prevBlock.id,
                    text: { symbolic: '', semantic: '' },
                    position: { start: 0, end: 0 }
                })
            }

            prevBlock.text = mergedText
            prevBlock.inlines = newInlines


            const index = this.ast.ast.blocks.findIndex(b => b.id === ctx.block.id)

            this.ast.ast.blocks.splice(index, 1)

            let targetInlineIndex: number
            if (ctx.inline.type === prevBlock.inlines[prevLastInlineIndex].type && ctx.inline.type === 'text') {
                targetInlineIndex = prevLastInlineIndex
            } else {
                targetInlineIndex = prevLastInlineIndex + 1
            }
            const targetInline = newInlines[targetInlineIndex]

            this.caret.setInlineId(targetInline.id)
            this.caret.setBlockId(targetInline.blockId)
            this.caret.setPosition(targetPosition)

            renderBlock(prevBlock, this.root)

            const blockEl = this.root.querySelector(`[data-block-id="${ctx.block.id}"]`)
            if (blockEl) {
                blockEl.remove()
            }

            this.updateAST()

            console.log('ast', JSON.stringify(this.ast.ast, null, 2))

            requestAnimationFrame(() => {
                this.caret?.restoreCaret()
            })

            this.emitChange()

            this.isEditing = false
            return
        }

        console.log('ctx.block.inlines', JSON.stringify(ctx.block.inlines, null, 2))

        const previousInline = ctx.block.inlines[ctx.inlineIndex - 1]

        const currentBlockText = ctx.block.inlines.map((i: Inline) => {
            if (i.id === previousInline.id && previousInline.text.symbolic.length > 0) {
                return i.text.symbolic.slice(0, -1)
            }
            return i.text.symbolic
        }).join('')

        const newInlines = parseInlineContent(currentBlockText, ctx.block.id, previousInline.position.end - 1)

        ctx.block.inlines = newInlines

        console.log('newInlines', JSON.stringify(newInlines, null, 2))

        const targetInline = newInlines[ctx.inlineIndex - 1]

        this.caret.setInlineId(targetInline.id)
        this.caret.setBlockId(targetInline.blockId)
        this.caret.setPosition(targetInline.position.end)

        renderBlock(ctx.block, this.root)

        this.updateAST()
        this.caret?.restoreCaret()
        this.emitChange()
        
        this.isEditing = false
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
        const flattenedBlocks = this.flattenBlocks(this.ast.ast.blocks)
        const blockIndex = flattenedBlocks.findIndex(b => b.id === block.id)

        const newBlock = buildBlocks(text, this.ast.ast)[0]

        const oldBlockEl = this.root.querySelector(`[data-block-id="${block.id}"]`)
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
                    renderBlock(newBlock, this.root, null, prevBlock)
                } else {
                    renderBlock(newBlock, this.root)
                }

                this.updateAST()
                this.caret?.restoreCaret()
                this.emitChange()
            
                this.isEditing = false
                return
            }
        }

        this.ast.ast.blocks.splice(blockIndex, 1, newBlock)

        const prevBlock = this.ast.ast.blocks[blockIndex - 1]
        if (prevBlock) {
            renderBlock(newBlock, this.root, null, prevBlock)
        } else {
            renderBlock(newBlock, this.root)
        }

        this.updateAST()
        this.caret?.restoreCaret()
        this.emitChange()

        this.isEditing = false
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

    private resolveInlineContext() {
        const blockId = this.caret.getBlockId()
        const inlineId = this.caret.getInlineId()
        // console.log('resolve 0')
    
        if (!blockId || !inlineId) return null
    
        // console.log('engine.ast', JSON.stringify(this.engine.ast, null, 2))
        // console.log('resolve 1', blockId, inlineId)
        const block = this.ast.getBlockById(blockId)
        if (!block) return null
    
        // console.log('resolve 2', inlineId)
        const inlineIndex = block.inlines.findIndex(i => i.id === inlineId)
        if (inlineIndex === -1) return null
    
        // console.log('resolve 3')
        const inline = block.inlines[inlineIndex]
    
        // console.log('resolve 4')
        const inlineEl = this.root.querySelector(
            `[data-inline-id="${inlineId}"]`
        ) as HTMLElement | null
    
        // console.log('resolve 5')
        if (!inlineEl) return null
    
        return {
            inline,
            block,
            inlineIndex,
            inlineEl
        }
    }

    private updateAST() {
        const ast = this.ast.ast
        let globalPos = 0

        const updateBlock = (block: Block): string => {
            const start = globalPos
            let text = ''

            if (!('blocks' in block) || !block.blocks) {
                let localPos = 0

                for (const inline of block.inlines) {
                    if (!inline.id) inline.id = uuid()
                        const len = inline.text.symbolic.length
                        inline.position = {
                        start: localPos,
                        end: localPos + len,
                    }
                    localPos += len
                }

                text = block.inlines.map((i: Inline) => i.text.symbolic).join('')
                block.text = text
                block.position = { start, end: start + text.length }
                globalPos += text.length

                return text
            }

            if (block.type === 'list') {
                const parts: string[] = []

                for (let i = 0; i < block.blocks.length; i++) {
                    const item = block.blocks[i]
                    const itemText = updateBlock(item)
                    parts.push(itemText)

                    if (i < block.blocks.length - 1) {
                        parts.push('\n')
                        globalPos += 1
                    }
                }

                text = parts.join('')
            }

            else if (block.type === 'listItem') {
                const marker = '- '
                text += marker
                globalPos += marker.length

                const content = updateBlock(block.blocks[0])
                text += content
            }

            block.text = text
            block.position = { start, end: globalPos }

            return text
        }

        const parts: string[] = []
        for (let i = 0; i < ast.blocks.length; i++) {
            parts.push(updateBlock(ast.blocks[i]))
            if (i < ast.blocks.length - 1) {
                parts.push('\n')
                globalPos += 1
            }
        }

        ast.text = parts.join('')
        this.ast.text = ast.text

        // console.log('ast', JSON.stringify(ast, null, 2))
    }
}

export default Editor
