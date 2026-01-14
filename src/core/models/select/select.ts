import Ast from '../ast/ast'
import Caret from '../caret'
import Focus from './focus'
import { getInlineElementFromNode } from './dom'
import { resolveRangeFromSelection, resolveInlineContext } from './map'
import type { EditContext, SelectionRange, EditEffect } from '../../types'

class Select {
    private rafId: number | null = null
    private range: SelectionRange | null = null
    private suppressSelectionChange = false
    private multiInlineMode = false

    private focusState = {
        focusedBlockId: null as string | null,
        focusedInlineId: null as string | null,
        focusedInlineIds: [] as string[],
        focusedBlockIds: [] as string[],
    }

    private focus: Focus

    constructor(
        private ast: Ast,
        private caret: Caret,
        private rootElement: HTMLElement
    ) {
        this.focus = new Focus(ast, rootElement, () => this.multiInlineMode)
    }

    attach() {
        document.addEventListener('selectionchange', this.onSelectionChange)
        this.rootElement.addEventListener('focusin', this.onRootFocusIn)
        this.rootElement.addEventListener('focusout', this.onRootFocusOut)
    }

    detach() {
        document.removeEventListener('selectionchange', this.onSelectionChange)
        this.rootElement.removeEventListener('focusin', this.onRootFocusIn)
        this.rootElement.removeEventListener('focusout', this.onRootFocusOut)
    }

    private onSelectionChange = () => {
        if (this.suppressSelectionChange) return

        if (this.rafId !== null) cancelAnimationFrame(this.rafId)

        this.rafId = requestAnimationFrame(() => {
            const selection = window.getSelection()
            if (!selection || selection.rangeCount === 0) {
                this.range = null
                this.caret.clear()
                this.multiInlineMode = false

                this.focus.unfocusBlocks(this.focusState.focusedBlockIds, [], [])
                this.focus.unfocusInlines(this.focusState.focusedInlineIds)
                this.focusState.focusedBlockIds = []
                this.focusState.focusedInlineIds = []
                return
            }

            const domRange = selection.getRangeAt(0)

            if (domRange.collapsed) {
                if (this.multiInlineMode) {
                    this.focus.unfocusBlocks(this.focusState.focusedBlockIds)
                    this.focus.unfocusInlines(this.focusState.focusedInlineIds)
                    this.focusState.focusedBlockIds = []
                    this.focusState.focusedInlineIds = []
                }
                this.multiInlineMode = false
                
                const currentInlineEl = getInlineElementFromNode(domRange.startContainer)
                const currentInlineId = currentInlineEl?.dataset?.inlineId ?? null

                if (currentInlineId !== this.focusState.focusedInlineId) {
                    if (currentInlineId) {
                        const inline = this.ast.query.getInlineById(currentInlineId)
                        if (inline) {
                            if (inline.blockId !== this.focusState.focusedBlockId) {
                                this.focus.resolveBlockMarkerTransition(this.focusState, inline.blockId)
                            }
                        }
                    }

                    this.focus.resolveInlineTransition(
                        this.focusState,
                        currentInlineId,
                        selection,
                        domRange,
                        (v: boolean) => (this.suppressSelectionChange = v)
                    )
                }
            }

            this.range = resolveRangeFromSelection(this.ast, this.caret, selection)
            if (!this.range) {
                this.caret.clear()
                this.multiInlineMode = false
                this.focus.unfocusBlocks(this.focusState.focusedBlockIds, [], [])
                this.focus.unfocusInlines(this.focusState.focusedInlineIds)
                this.focusState.focusedBlockIds = []
                this.focusState.focusedInlineIds = []
            } else if (!domRange.collapsed) {
                const wasMultiInlineMode = this.multiInlineMode
                this.multiInlineMode = this.hasMultiInlineSelection(this.range)
                
                const inlineIds = this.getInlineIdsInRange(this.range)
                const blockIds = this.getBlockIdsInRange(this.range)
                
                if (this.multiInlineMode) {
                    if (!wasMultiInlineMode) {
                        if (this.focusState.focusedInlineId) {
                            this.focus.unfocusCurrentInline(this.focusState)
                            this.focusState.focusedInlineId = null
                        }
                        if (this.focusState.focusedBlockId) {
                            const prevBlock = this.ast.query.getBlockById(this.focusState.focusedBlockId)
                            if (prevBlock) {
                                const marker = prevBlock.inlines.find(i => i.type === 'marker')
                                if (marker) {
                                    this.focus.unfocusInline(marker.id)
                                }
                            }
                            this.focusState.focusedBlockId = null
                        }
                    }
                    
                    const newInlineIds = inlineIds.filter(id => !this.focusState.focusedInlineIds.includes(id))
                    const removedInlineIds = this.focusState.focusedInlineIds.filter(id => !inlineIds.includes(id))
                    
                    this.focus.unfocusInlines(removedInlineIds)
                    this.focus.focusInlines(newInlineIds)
                    this.focusState.focusedInlineIds = inlineIds
                    
                    const newBlockIds = blockIds.filter(id => !this.focusState.focusedBlockIds.includes(id))
                    const removedBlockIds = this.focusState.focusedBlockIds.filter(id => !blockIds.includes(id))
                    
                    this.focus.unfocusBlocks(removedBlockIds, inlineIds, blockIds)
                    this.focus.focusBlocks(newBlockIds)
                    this.focusState.focusedBlockIds = blockIds
                } else {
                    if (!wasMultiInlineMode) {
                        if (this.focusState.focusedInlineId) {
                            this.focus.unfocusCurrentInline(this.focusState)
                            this.focusState.focusedInlineId = null
                        }
                        if (this.focusState.focusedBlockId) {
                            const prevBlock = this.ast.query.getBlockById(this.focusState.focusedBlockId)
                            if (prevBlock) {
                                const marker = prevBlock.inlines.find(i => i.type === 'marker')
                                if (marker) {
                                    this.focus.unfocusInline(marker.id)
                                }
                            }
                            this.focusState.focusedBlockId = null
                        }
                    }
                    
                    this.focus.unfocusBlocks(this.focusState.focusedBlockIds, inlineIds, blockIds)
                    this.focus.unfocusInlines(this.focusState.focusedInlineIds)
                    this.focusState.focusedBlockIds = []
                    this.focusState.focusedInlineIds = []
                    
                    this.focus.focusInlines(inlineIds)
                    this.focusState.focusedInlineIds = inlineIds
                    
                    const allBlockIds = this.getBlockIdsInRange(this.range)
                    this.focus.focusBlocks(allBlockIds)
                    this.focusState.focusedBlockIds = allBlockIds
                }
            } else {
                if (this.multiInlineMode) {
                    this.focus.unfocusBlocks(this.focusState.focusedBlockIds, [], [])
                    this.focus.unfocusInlines(this.focusState.focusedInlineIds)
                    this.focusState.focusedBlockIds = []
                    this.focusState.focusedInlineIds = []
                }
                this.multiInlineMode = false
            }
        })
    }

    private hasMultiInlineSelection(range: SelectionRange): boolean {
        const isCollapsed = range.start.blockId === range.end.blockId &&
            range.start.inlineId === range.end.inlineId &&
            range.start.position === range.end.position

        if (isCollapsed) {
            return false
        }

        const spansMultipleInlines = range.start.inlineId !== range.end.inlineId ||
            range.start.blockId !== range.end.blockId

        return spansMultipleInlines
    }

    private getInlineIdsInRange(range: SelectionRange): string[] {
        const inlineIds = new Set<string>()
        const flatInlines = this.ast.query.flattenInlines(this.ast.blocks)
        
        let inRange = false
        let startFound = false
        let endFound = false
        
        for (const entry of flatInlines) {
            if (entry.inline.type === 'marker') continue
            
            const isStart = entry.inline.id === range.start.inlineId
            const isEnd = entry.inline.id === range.end.inlineId
            
            if (isStart) {
                startFound = true
                inRange = true
                inlineIds.add(entry.inline.id)
                
                if (isEnd) {
                    endFound = true
                    break
                }
                continue
            }
            
            if (inRange) {
                inlineIds.add(entry.inline.id)
                
                if (isEnd) {
                    endFound = true
                    break
                }
            }
        }
        
        if (!startFound) inlineIds.add(range.start.inlineId)
        if (!endFound) inlineIds.add(range.end.inlineId)
        
        return Array.from(inlineIds)
    }

    private getBlockIdsInRange(range: SelectionRange): string[] {
        const blockIds = new Set<string>()
        const flatBlocks = this.ast.query.flattenBlocks(this.ast.blocks)
        
        let inRange = false
        let startFound = false
        let endFound = false
        
        for (const entry of flatBlocks) {
            const isStart = entry.block.id === range.start.blockId
            const isEnd = entry.block.id === range.end.blockId
            
            if (isStart) {
                startFound = true
                inRange = true
                blockIds.add(entry.block.id)
                
                if (isEnd) {
                    endFound = true
                    break
                }
                continue
            }
            
            if (inRange) {
                blockIds.add(entry.block.id)
                
                if (isEnd) {
                    endFound = true
                    break
                }
            }
        }
        
        if (!startFound) blockIds.add(range.start.blockId)
        if (!endFound) blockIds.add(range.end.blockId)
        
        return Array.from(blockIds)
    }

    private onRootFocusIn = (_e: FocusEvent) => {}

    private onRootFocusOut = (e: FocusEvent) => {
        if (!this.rootElement.contains(e.relatedTarget as Node)) {
            this.focus.unfocusCurrentInline(this.focusState)
            this.focus.unfocusBlocks(this.focusState.focusedBlockIds, [], [])
            this.focus.unfocusInlines(this.focusState.focusedInlineIds)
            this.caret.clear()
            this.focus.clear(this.focusState)
            this.focusState.focusedBlockIds = []
            this.focusState.focusedInlineIds = []
            this.multiInlineMode = false
        }
    }

    public resolveInlineContext(): EditContext | null {
        return resolveInlineContext(this.ast, this.caret, this.rootElement)
    }

    public resolveRange(): SelectionRange | null {
        return this.range
    }

    public isMultiInlineMode(): boolean {
        return this.multiInlineMode
    }

    public getSelectedText(): string {
        if (!this.range) return ''
        
        const startBlock = this.ast.query.getBlockById(this.range.start.blockId)
        const endBlock = this.ast.query.getBlockById(this.range.end.blockId)
        if (!startBlock || !endBlock) return ''
        
        const getOffsetInBlock = (block: typeof startBlock, inlineId: string, position: number): number => {
            let offset = 0
            for (const inline of block.inlines) {
                if (inline.id === inlineId) {
                    return offset + position
                }
                offset += inline.text.symbolic.length
            }
            return offset
        }
        
        const startOffset = getOffsetInBlock(startBlock, this.range.start.inlineId, this.range.start.position)
        const endOffset = getOffsetInBlock(endBlock, this.range.end.inlineId, this.range.end.position)
        
        const startTextPos = startBlock.position.start + startOffset
        const endTextPos = endBlock.position.start + endOffset

        return this.ast.text.slice(startTextPos, endTextPos)
    }

    public paste(text: string): EditEffect | null {
        if (!this.range) {
            const context = this.resolveInlineContext()
            if (!context) return null
            
            const caretPosition = this.caret.position ?? 0
            const currentText = context.inline.text.symbolic
            const newText = currentText.slice(0, caretPosition) + text + currentText.slice(caretPosition)
            const newCaretPosition = caretPosition + text.length
            
            return {
                preventDefault: true,
                ast: [{
                    type: 'input',
                    blockId: context.block.id,
                    inlineId: context.inline.id,
                    text: newText,
                    caretPosition: newCaretPosition,
                }],
            }
        }
        
        if (this.range.start.blockId !== this.range.end.blockId) {
            return null
        }
        
        const startBlock = this.ast.query.getBlockById(this.range.start.blockId)
        const startInline = this.ast.query.getInlineById(this.range.start.inlineId)
        if (!startBlock || !startInline) return null
        
        const startInlineIndex = startBlock.inlines.findIndex(i => i.id === startInline.id)
        const endInline = this.ast.query.getInlineById(this.range.end.inlineId)
        if (!endInline) return null
        
        if (startInline.id === endInline.id) {
            const currentText = startInline.text.symbolic
            const newText = currentText.slice(0, this.range.start.position) + text + currentText.slice(this.range.end.position)
            const newCaretPosition = this.range.start.position + text.length
            
            return {
                preventDefault: true,
                ast: [{
                    type: 'input',
                    blockId: startBlock.id,
                    inlineId: startInline.id,
                    text: newText,
                    caretPosition: newCaretPosition,
                }],
            }
        }
        
        const endInlineIndex = startBlock.inlines.findIndex(i => i.id === endInline.id)
        
        const textBefore = startBlock.inlines
            .slice(0, startInlineIndex)
            .map(i => i.text.symbolic)
            .join('') + startInline.text.symbolic.slice(0, this.range.start.position)
        
        const textAfter = endInline.text.symbolic.slice(this.range.end.position) +
            startBlock.inlines
                .slice(endInlineIndex + 1)
                .map(i => i.text.symbolic)
                .join('')
        
        const newText = textBefore + text + textAfter
        const newCaretPosition = this.range.start.position + text.length
        
        return {
            preventDefault: true,
            ast: [{
                type: 'input',
                blockId: startBlock.id,
                inlineId: startInline.id,
                text: newText,
                caretPosition: newCaretPosition,
            }],
        }
    }
}

export default Select
