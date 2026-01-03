import Engine from '../engine/engine'
import Caret from './caret'
import { renderAST } from '../render/render'
import { renderBlock } from '../render/renderBlock'
import css from './SyntheticText.scss?inline'
import { parseInlineContent } from '../ast/ast'
import { Block, BlockType, Inline } from '../ast/types'
import { uuid } from '../utils/utils'

export class SyntheticText extends HTMLElement {
    private root: ShadowRoot
    private styled = false
    private syntheticEl?: HTMLDivElement
    private engine = new Engine()
    private caret = new Caret()
    private connected = false
    private isRendered = false
    private isEditing = false
    private focusedBlockId: string | null = null
    private focusedInlineId: string | null = null


    constructor() {
        super()
        this.root = this.attachShadow({ mode: 'open' })
    }

    connectedCallback() {
        this.connected = true
        this.engine = new Engine(this.textContent ?? '')
        this.addStyles()
        this.addDOM()
        this.render()
    }

    set value(value: string) {
        this.engine.setText(value)
        if (this.connected && !this.isRendered) {
          this.render()
          this.isRendered = true
        }
    }

    get value() {
        return this.engine.getText()
    }

    private render() {
        if (!this.syntheticEl) return
        const ast = this.engine.getAst()
        if (!ast) return

        renderAST(ast, this.syntheticEl)
    }

    private addStyles() {
        if (this.styled) return
    
        const style = document.createElement('style')
        style.textContent = css
        this.root.appendChild(style)
    
        this.styled = true
    }

    private addDOM() {
        if (this.syntheticEl) return
    
        const div = document.createElement('div')
        div.classList.add('syntheticText')

        document.addEventListener('selectionchange', () => {
            // console.log('selectionchange')
            if (this.isEditing) return;
            if (!this.syntheticEl) return;
        
            requestAnimationFrame(() => {
                const selection = window.getSelection();
                if (!selection?.rangeCount) return;
            
                const range = selection.getRangeAt(0);
                const container = range.commonAncestorContainer;
            
                let inlineEl: HTMLElement | null = null;
            
                if (container instanceof HTMLElement) {
                inlineEl = container.closest('[data-inline-id]') ?? null;
                } else if (container instanceof Text) {
                inlineEl = container.parentElement?.closest('[data-inline-id]') ?? null;
                }
            
                if (!inlineEl || !this.syntheticEl?.contains(inlineEl)) {
                this.caret.clear();
                return;
                }
            
                const inlineId = inlineEl.dataset.inlineId!;
                const inline = this.engine.getInlineById(inlineId);
                if (!inline) return;

                const block = this.engine.getBlockById(inline.blockId);
                if (!block) return;

                this.caret.setInlineId(inlineId);
                this.caret.setBlockId(inline.blockId);
            
                const preRange = range.cloneRange();
                preRange.selectNodeContents(inlineEl);
                preRange.setEnd(range.startContainer, range.startOffset);
                let position = preRange.toString().length + inline.position.start + block.position.start;
            
                this.caret.setPosition(position);
            
                // console.log('Caret moved to:', inlineId, 'position:', position);
            })
        });

        div.addEventListener('focusin', (e: FocusEvent) => {
            const target = e.target as HTMLElement;
            if (!target.dataset?.inlineId) return;
          
            const inline = this.engine.getInlineById(target.dataset.inlineId!);
            if (!inline) return;

            const selection = window.getSelection();
            if (!selection || selection.rangeCount === 0) return;

            const range = selection.getRangeAt(0);

            let syntheticOffset = 0;
            if (target.contains(range.startContainer)) {
                const preRange = document.createRange();
                preRange.selectNodeContents(target);
                preRange.setEnd(range.startContainer, range.startOffset);
                syntheticOffset = preRange.toString().length;
            }

            const syntheticVisibleLength = target.textContent?.length ?? 1;

            target.innerHTML = '';
            const newTextNode = document.createTextNode(inline.text.symbolic);
            target.appendChild(newTextNode);

            const symbolicOffset = this.mapSyntheticOffsetToSymbolic(
                syntheticVisibleLength,
                inline.text.symbolic.length,
                syntheticOffset
            );

            const clampedOffset = Math.max(0, Math.min(symbolicOffset, inline.text.symbolic.length));
            const newRange = document.createRange();
            newRange.setStart(newTextNode, clampedOffset);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);

            this.focusedInlineId = inline.id;
            this.focusedBlockId = inline.blockId;
        });

        div.addEventListener('focusout', (e) => {
            if (this.focusedInlineId !== null) {
                const inlineEl = this.syntheticEl?.querySelector(`[data-inline-id="${this.focusedInlineId}"]`) as HTMLElement;
                if (!inlineEl) return;

                const inline = this.engine.getInlineById(this.focusedInlineId);
                if (inline) {
                    inlineEl.innerHTML = '';
                    const newTextNode = document.createTextNode(inline.text.semantic);
                    inlineEl.appendChild(newTextNode);
                }
            }

            // console.log('focusout')
            if (!this.syntheticEl?.contains(e.relatedTarget as Node)) {
                const target = e.target as HTMLElement
                if (!target.dataset?.inlineId) return;

                const inlineId = target.dataset.inlineId!;
                const inline = this.engine.getInlineById(inlineId);
                if (!inline) return;

                target.innerHTML = '';
                const newTextNode = document.createTextNode(inline.text.semantic);
                target.appendChild(newTextNode);

                this.isEditing = false;
                this.caret.clear();
                this.focusedInlineId = null;
                this.focusedBlockId = null;
            }
        })

        div.addEventListener('input', this.onInput.bind(this))

        div.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Enter') {
                this.onEnter(e)
            }
            if (e.key === 'Backspace') {
                this.onBackspace(e)
            }
        })
    
        this.root.appendChild(div)
        this.syntheticEl = div
    }

    private onEnter(e: KeyboardEvent) {
        console.log('enter')
        // const ctx = this.resolveInlineContext(e)
        const ctx = this.resolveInlineContext()
        if (!ctx) return

        this.isEditing = true

        e.preventDefault()

        const caretPosition = this.caret.getPositionInInline(ctx.inlineEl)
        const blocks = this.engine.ast.blocks
        const blockIndex = blocks.findIndex(b => b.id === ctx.block.id)

        if (blockIndex === -1) return

        console.log('caretPosition', caretPosition)

        if (ctx.inlineIndex === 0 && caretPosition === 0) {
            console.log('enter at start of block')

            const emptyInline: Inline = {
                id: uuid(),
                type: 'text',
                blockId: ctx.block.id,
                text: { symbolic: '', semantic: '' },
                position: { start: 0, end: 0 }
            }

            const inlines = ctx.block.inlines
            const text = inlines.map(i => i.text.symbolic).join('')

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

            renderBlock(ctx.block, this.syntheticEl!)
            renderBlock(newBlock, this.syntheticEl!, null, ctx.block)

            this.updateAST()

            requestAnimationFrame(() => {
                this.restoreCaret()
            })

            this.emitChange()

            // console.log('ast', JSON.stringify(this.engine.ast, null, 2))

            this.isEditing = false
            return
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

        renderBlock(ctx.block, this.syntheticEl!)
        renderBlock(newBlock, this.syntheticEl!, null, ctx.block)

        this.updateAST()
        this.restoreCaret()
        this.emitChange()

        // console.log('ast', JSON.stringify(this.engine.ast, null, 2))

        // console.log(`inline ${ctx.inline.id} split: ${ctx.inline.text.symbolic} > ${ctx.inlineEl.textContent ?? ''}`)

        this.isEditing = false
    }

    private onBackspace(e: KeyboardEvent) {
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

        if (ctx.inlineIndex === 0 && caretPosition === 0) {
            console.log('backspace at start of block')
            const blockIndex = this.engine.ast.blocks.findIndex(b => b.id === ctx.block.id)
            if (blockIndex <= 0) {
                this.isEditing = false
                return
            }

            const prevBlock = this.engine.ast.blocks[blockIndex - 1]

            const prevLastInlineIndex = prevBlock.inlines.length - 1
            const targetPosition = prevBlock.inlines[prevLastInlineIndex].position.end
            console.log('targetPosition', targetPosition)

            const prevText = prevBlock.inlines
                .map(i => i.text.symbolic)
                .join('')

            const currText = ctx.block.inlines
                .map(i => i.text.symbolic)
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


            this.engine.ast.blocks.splice(blockIndex, 1)
            // console.log('prevBlock', JSON.stringify(mergedText, null, 2))

            // console.log('ctx.inline.type', JSON.stringify(prevBlock.inlines, null, 2))
            let targetInlineIndex: number
            if (ctx.inline.type === prevBlock.inlines[prevLastInlineIndex].type && ctx.inline.type === 'text') {
                targetInlineIndex = prevLastInlineIndex
            } else {
                targetInlineIndex = prevLastInlineIndex + 1
            }
            const targetInline = newInlines[targetInlineIndex]

            // console.log('prevBlock.inlines.length', JSON.stringify(newInlines, null, 2))
            // console.log('targetInline', JSON.stringify(prevBlock.inlines.length, null, 2))

            this.caret.setInlineId(targetInline.id)
            this.caret.setBlockId(targetInline.blockId)
            this.caret.setPosition(targetPosition)

            renderBlock(prevBlock, this.syntheticEl!)

            const blockEl = this.syntheticEl?.querySelector(`[data-block-id="${ctx.block.id}"]`)
            if (blockEl) {
                blockEl.remove()
            }

            this.updateAST()

            requestAnimationFrame(() => {
                this.restoreCaret()
            })

            this.emitChange()

            this.isEditing = false
            return
        }

        const previousInline = ctx.block.inlines[ctx.inlineIndex - 1]

        const currentBlockText = ctx.block.inlines.map(i => {
            if (i.id === previousInline.id && previousInline.text.symbolic.length > 0) {
                return i.text.symbolic.slice(0, -1)
            }
            return i.text.symbolic
        }).join('')

        const newInlines = parseInlineContent(currentBlockText, ctx.block.id, previousInline.position.end - 1)

        ctx.block.inlines = newInlines

        const targetInline = newInlines[ctx.inlineIndex - 1]

        this.caret.setInlineId(targetInline.id)
        this.caret.setBlockId(targetInline.blockId)

        renderBlock(ctx.block, this.syntheticEl!)

        this.updateAST()
        this.restoreCaret()
        this.emitChange()
        
        this.isEditing = false
    }

    private onInput(e: Event) {
        console.log('onInput')
        // const ctx = this.resolveInlineContext(e)
        const ctx = this.resolveInlineContext()
        if (!ctx) return

        this.isEditing = true;

        const caretOffset = this.caret.getPositionInInline(ctx.inlineEl)
        const result = this.normalizeTextContext({
            inline: ctx.inline,
            block: ctx.block,
            inlineIndex: ctx.inlineIndex,
            value: ctx.inlineEl.textContent ?? '',
            caretOffset
        })

        this.applyInlineNormalization(ctx.block, result)
    
        renderBlock(ctx.block, this.syntheticEl!, result.caretInline?.id ?? null)

        console.log(`inline ${ctx.inline.id} changed: ${ctx.inline.text.symbolic} > ${ctx.inlineEl.textContent ?? ''}`)

        this.updateAST()
        this.restoreCaret()
        this.emitChange()

        this.isEditing = false;
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
    
    

    private emitChange() {
        this.dispatchEvent(new CustomEvent('change', {
            detail: { value: this.engine.getText() },
            bubbles: true,
            composed: true,
        }))
    }

    private updateBlock(block: Block) {
        // // console.log('updateBlock', JSON.stringify(block, null, 2))
        // let pos = 0;
        // for (const inline of block.inlines) {
        //     if (!inline.id) inline.id = uuid()
        //     const len = inline.text.symbolic.length
        //     inline.position = { start: pos, end: pos + len }
        //     pos += len
        // }

        // block.text = block.inlines.map(i => i.text.symbolic).join('')

        // if (!block.id) block.id = uuid()

        // block.position = {
        //     start: block.inlines[0]?.position.start ?? 0,
        //     end: block.inlines[block.inlines.length - 1]?.position.end ?? 0,
        // }
    }

    private updateAST() {
        const ast = this.engine.ast

        let globalPos = 0;

        for (const block of ast.blocks) {
            const blockStart = globalPos;

            for (const inline of block.inlines) {
                if (!inline.id) inline.id = uuid()
                const len = inline.text.symbolic.length
                inline.position = { start: 0, end: len };
            }

            block.text = block.inlines.map(i => i.text.symbolic).join('')
            block.position = { start: blockStart, end: blockStart +block.text.length }

            if (!block.id) block.id = uuid()

            globalPos += 1
        }

        const joinedText = ast.blocks.map(b => b.text).join('\n')
        this.engine.text = joinedText
        this.engine.ast.text = joinedText

        // console.log('ast', JSON.stringify(this.engine.ast, null, 2))
    }

    private restoreCaret() {
        if (!this.caret.getInlineId() || this.caret.getPosition() === null) {
          return;
        }
      
        const inlineId = this.caret.getInlineId()!;
        const position = this.caret.getPosition()!;
      
        const inlineEl = this.syntheticEl?.querySelector(`[data-inline-id="${inlineId}"]`) as HTMLElement;
        if (!inlineEl) {
          console.warn('Could not find inline element for caret restore:', inlineId);
          return;
        }
      
        inlineEl.focus();
      
        const selection = window.getSelection();
        if (!selection) return;
      
        selection.removeAllRanges();
        const range = document.createRange();
      
        try {
          let placed = false;
      
          if (inlineEl.childNodes.length > 0 && inlineEl.firstChild instanceof Text) {
            const textNode = inlineEl.firstChild as Text;
            const clamped = Math.min(position, textNode.length);
            range.setStart(textNode, clamped);
            range.collapse(true);
            placed = true;
          } 
          else if (inlineEl.childNodes.length > 0) {
            let currentPos = 0;
            const walker = document.createTreeWalker(
              inlineEl,
              NodeFilter.SHOW_TEXT,
              null
            );
      
            let node: Text | null;
            while ((node = walker.nextNode() as Text)) {
              const len = node.length;
              if (currentPos + len >= position) {
                range.setStart(node, position - currentPos);
                range.collapse(true);
                placed = true;
                break;
              }
              currentPos += len;
            }
          }
      
          if (!placed) {
            if (inlineEl.childNodes.length > 0) {
              range.selectNodeContents(inlineEl);
              range.collapse(false);
            } else {
              range.setStart(inlineEl, 0);
              range.collapse(true);
            }
          }
      
          selection.addRange(range);
      
          inlineEl.focus();
      
          inlineEl.scrollIntoView({ block: 'nearest' });
      
        } catch (err) {
          console.warn('Failed to restore caret:', err);
          inlineEl.focus();
        }
    }

    private mapSyntheticOffsetToSymbolic(
        syntheticLength: number,
        symbolicLength: number,
        syntheticOffset: number
    ) {
        if (syntheticOffset === 0) return 0;
        let ratio = symbolicLength / syntheticLength;
        ratio = Math.max(0.5, Math.min(2.0, ratio));
        let offset = Math.round(syntheticOffset * ratio);

        return Math.max(0, Math.min(offset, symbolicLength));
    }

    // private resolveInlineContext(e: Event) {
    //     if (!this.syntheticEl) return null
    //     console.log('resolve 0')

    //     const target = e.target as HTMLDivElement
    //     if (!target.dataset?.inlineId) return null
    //     console.log('resolve 1')
        
    //     const inlineId = target.dataset.inlineId!

    //     const inline = this.engine.getInlineById(inlineId)
    //     if (!inline) return null
    //     console.log('resolve 2')
    //     const block = this.engine.getBlockById(inline.blockId)
    //     if (!block) return null
    //     console.log('resolve 3', inlineId, JSON.stringify(block.inlines, null, 2))
    //     const inlineIndex = block.inlines.findIndex(i => i.id === inlineId)
    //     if (inlineIndex === -1) return null
    //     console.log('resolve 4')
    //     const ctx: {
    //         inline: Inline,
    //         block: Block,
    //         inlineIndex: number,
    //         inlineEl: HTMLElement
    //     } = { inline, block, inlineIndex, inlineEl: target }

    //     return ctx
    // }

    private resolveInlineContext() {
        const blockId = this.caret.getBlockId()
        const inlineId = this.caret.getInlineId()
        // console.log('resolve 0')
    
        if (!blockId || !inlineId) return null
    
        // console.log('engine.ast', JSON.stringify(this.engine.ast, null, 2))
        // console.log('resolve 1', blockId, inlineId)
        const block = this.engine.getBlockById(blockId)
        if (!block) return null
    
        // console.log('resolve 2', inlineId)
        const inlineIndex = block.inlines.findIndex(i => i.id === inlineId)
        if (inlineIndex === -1) return null
    
        // console.log('resolve 3')
        const inline = block.inlines[inlineIndex]
    
        // console.log('resolve 4')
        const inlineEl = this.syntheticEl?.querySelector(
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

    private restoreCaretByTextOffset() {
        const pending = this.caret.pendingTextRestore
        if (!pending) return
    
        const blockEl = this.syntheticEl?.querySelector(
            `[data-block-id="${pending.blockId}"]`
        )
        if (!blockEl) return
    
        let acc = 0
    
        const inlineEls = blockEl.querySelectorAll('[data-inline-id]')
    
        for (const inlineEl of inlineEls) {
            const text = inlineEl.textContent ?? ''
            const len = text.length
    
            if (acc + len >= pending.offset) {
                const offsetInInline = pending.offset - acc
                this.placeCaret(inlineEl.firstChild ?? inlineEl, offsetInInline)
                this.caret.pendingTextRestore = null
                return
            }
    
            acc += len
        }
    
        // fallback → end of block
        const lastInline = inlineEls[inlineEls.length - 1]
        if (lastInline) {
            const len = lastInline.textContent?.length ?? 0
            this.placeCaret(lastInline.firstChild ?? lastInline, len)
        }
    
        this.caret.pendingTextRestore = null
    }

    private placeCaret(target: Node, offset: number) {
        const selection = window.getSelection()
        if (!selection) return
    
        const range = document.createRange()
    
        // Normalize target:
        // If element node, try to use its first text child
        let node: Node = target
    
        if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.firstChild) {
                node = node.firstChild
            } else {
                // Empty element → caret can only be at offset 0
                range.setStart(node, 0)
                range.collapse(true)
                selection.removeAllRanges()
                selection.addRange(range)
                return
            }
        }
    
        if (node.nodeType !== Node.TEXT_NODE) return
    
        const textLength = node.textContent?.length ?? 0
        const safeOffset = Math.max(0, Math.min(offset, textLength))
    
        range.setStart(node, safeOffset)
        range.collapse(true)
    
        selection.removeAllRanges()
        selection.addRange(range)
    }
}
