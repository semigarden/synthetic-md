import type Ast from '../ast/ast'
import type { Inline } from '../../types'
import { mapSemanticOffsetToSymbolic } from './map'

type FocusState = {
    focusedBlockId: string | null
    focusedInlineId: string | null
    focusedInlineIds: string[]
    focusedBlockIds: string[]
}

type MultiInlineModeChecker = () => boolean

class Focus {
    constructor(
        private ast: Ast,
        private rootElement: HTMLElement,
        private isMultiInlineMode?: MultiInlineModeChecker
    ) {}

    public resolveInlineTransition(
        state: FocusState,
        newInlineId: string | null,
        selection: globalThis.Selection,
        range: Range,
        setSuppress: (v: boolean) => void
    ) {
        if (this.isMultiInlineMode && this.isMultiInlineMode()) {
            return
        }

        if (state.focusedInlineId) this.unfocusInline(state.focusedInlineId)
        if (newInlineId) this.focusInline(newInlineId, selection, range, setSuppress)

        state.focusedInlineId = newInlineId
    }

    public unfocusCurrentInline(state: FocusState) {
        if (state.focusedInlineId) this.unfocusInline(state.focusedInlineId)
    }

    public focusInlines(inlineIds: string[]) {
        const parentBlockIds = new Set<string>()
        
        for (const inlineId of inlineIds) {
            const inline = this.ast.query.getInlineById(inlineId)
            if (!inline) continue

            const inlineEl = this.rootElement.querySelector(
                `[data-inline-id="${inlineId}"]`
            ) as HTMLElement | null
            if (!inlineEl) continue

            if (inline.type !== 'image' && inlineEl.textContent === inline.text.symbolic) {
                let block = this.ast.query.getBlockById(inline.blockId)
                while (block) {
                    parentBlockIds.add(block.id)
                    block = this.ast.query.getParentBlock(block)
                }
                continue
            }

            inlineEl.textContent = inline.text.symbolic
            
            let block = this.ast.query.getBlockById(inline.blockId)
            while (block) {
                parentBlockIds.add(block.id)
                block = this.ast.query.getParentBlock(block)
            }
        }
        
        this.focusBlocks(Array.from(parentBlockIds))
    }

    public unfocusInlines(inlineIds: string[]) {
        for (const inlineId of inlineIds) {
            this.unfocusInline(inlineId)
        }
    }

    public focusBlocks(blockIds: string[]) {
        const allBlockIds = new Set<string>()
        
        for (const blockId of blockIds) {
            let block = this.ast.query.getBlockById(blockId)
            while (block) {
                allBlockIds.add(block.id)
                block = this.ast.query.getParentBlock(block)
            }
        }
        
        for (const blockId of allBlockIds) {
            const block = this.ast.query.getBlockById(blockId)
            if (!block) continue

            const marker = block.inlines.find(i => i.type === 'marker')
            if (marker && marker.text.symbolic.length > 0) {
                const markerEl = this.rootElement.querySelector(
                    `[data-inline-id="${marker.id}"]`
                ) as HTMLElement | null
                if (markerEl) {
                    if (markerEl.textContent !== marker.text.symbolic) {
                        markerEl.textContent = marker.text.symbolic
                    }
                }
            }
        }
    }

    public unfocusBlocks(blockIds: string[], stillFocusedInlineIds: string[] = [], stillFocusedBlockIds: string[] = []) {
        const stillFocusedBlockSet = new Set(stillFocusedBlockIds)
        const stillFocusedInlineSet = new Set(stillFocusedInlineIds)
        
        for (const blockId of blockIds) {
            const block = this.ast.query.getBlockById(blockId)
            if (!block) continue

            const hasFocusedChildren = this.hasFocusedChildren(block, stillFocusedInlineSet, stillFocusedBlockSet)
            if (hasFocusedChildren) continue

            const marker = block.inlines.find(i => i.type === 'marker')
            if (marker && marker.text.symbolic.length > 0) {
                const markerEl = this.rootElement.querySelector(
                    `[data-inline-id="${marker.id}"]`
                ) as HTMLElement | null
                if (markerEl) {
                    markerEl.textContent = marker.text.semantic
                }
            }
        }
    }
    
    private hasFocusedChildren(block: import('../../types').Block, focusedInlineIds: Set<string>, focusedBlockIds: Set<string>): boolean {
        if ('blocks' in block && block.blocks) {
            for (const childBlock of block.blocks) {
                if (focusedBlockIds.has(childBlock.id)) return true
                if (this.hasFocusedChildren(childBlock, focusedInlineIds, focusedBlockIds)) return true
            }
        }
        
        for (const inline of block.inlines) {
            if (inline.type === 'marker') continue
            if (focusedInlineIds.has(inline.id)) return true
        }
        
        return false
    }

    public clear(state: FocusState) {
        state.focusedInlineId = null
        state.focusedBlockId = null
    }

    private focusInline(
        inlineId: string,
        selection: globalThis.Selection,
        range: Range,
        setSuppress: (v: boolean) => void
    ) {
        const inline = this.ast.query.getInlineById(inlineId)
        if (!inline) return

        const block = this.ast.query.getBlockById(inline.blockId)
        if (!block) return

        const inlineEl = this.rootElement.querySelector(
            `[data-inline-id="${inlineId}"]`
        ) as HTMLElement | null
        if (!inlineEl) return

        let localOffset = 0
        if (inlineEl.contains(range.startContainer)) {
            const preRange = document.createRange()
            preRange.selectNodeContents(inlineEl)
            preRange.setEnd(range.startContainer, range.startOffset)
            localOffset = preRange.toString().length
        }

        const symbolicOffset = mapSemanticOffsetToSymbolic(
            inline.text.semantic.length,
            inline.text.symbolic.length,
            localOffset
        )

        setSuppress(true)
        inlineEl.textContent = inline.text.symbolic

        const textNode = inlineEl.firstChild
        if (textNode instanceof Text) {
            const clampedOffset = Math.max(0, Math.min(symbolicOffset, textNode.length))
            const newRange = document.createRange()
            newRange.setStart(textNode, clampedOffset)
            newRange.collapse(true)
            selection.removeAllRanges()
            selection.addRange(newRange)
        }

        requestAnimationFrame(() => setSuppress(false))
    }

    public resolveBlockMarkerTransition(state: FocusState, newBlockId: string) {
        if (newBlockId === state.focusedBlockId) {
            const block = this.ast.query.getBlockById(newBlockId)
            if (block) {
                const marker = block.inlines.find(i => i.type === 'marker')
                if (marker && marker.text.symbolic.length > 0) {
                    const markerEl = this.rootElement.querySelector(
                        `[data-inline-id="${marker.id}"]`
                    ) as HTMLElement | null
                    if (markerEl && markerEl.textContent === marker.text.symbolic) {
                        return
                    }
                }
            }
            const parentBlockIds: string[] = []
            let currentBlock = this.ast.query.getBlockById(newBlockId)
            while (currentBlock) {
                parentBlockIds.push(currentBlock.id)
                currentBlock = this.ast.query.getParentBlock(currentBlock)
            }
            this.focusBlocks(parentBlockIds)
            return
        }

        const parentBlockIds: string[] = []
        let block = this.ast.query.getBlockById(newBlockId)
        while (block) {
            parentBlockIds.push(block.id)
            block = this.ast.query.getParentBlock(block)
        }
        
        this.focusBlocks(parentBlockIds)
        state.focusedBlockId = newBlockId
    }

    public unfocusInline(inlineId: string) {
        const inline = this.ast.query.getInlineById(inlineId)
        if (!inline) return

        const inlineEl = this.rootElement.querySelector(
            `[data-inline-id="${inlineId}"]`
        ) as HTMLElement | null
        if (!inlineEl) return

        if (inline.type === 'image') {
            const imageElement = document.createElement('img')
            imageElement.id = inline.id
            imageElement.dataset.inlineId = inline.id
            imageElement.classList.add('inline', 'image')
            ;(imageElement as HTMLImageElement).src = (inline as any).url || ''
            ;(imageElement as HTMLImageElement).alt = (inline as any).alt || ''
            ;(imageElement as HTMLImageElement).title = (inline as any).title || ''
            inlineEl.replaceWith(imageElement)
        } else {
            inlineEl.textContent = inline.text.semantic
        }

        const block = this.ast.query.getBlockById(inline.blockId)
        if (!block) return

        const marker = block.inlines.find(i => i.type === 'marker') as Inline | undefined
        if (marker && marker.text.symbolic.length) {
            const markerEl = this.rootElement.querySelector(
                `[data-inline-id="${marker.id}"]`
            ) as HTMLElement | null

            if (markerEl && marker.id !== inlineId) {
                if (markerEl.textContent === marker.text.symbolic) {
                    const hasOtherFocusedInlines = block.inlines.some(i => {
                        if (i.type === 'marker' || i.id === inlineId) return false
                        const otherInlineEl = this.rootElement.querySelector(
                            `[data-inline-id="${i.id}"]`
                        ) as HTMLElement | null
                        return otherInlineEl && otherInlineEl.textContent === i.text.symbolic
                    })
                    
                    if (!hasOtherFocusedInlines) {
                        markerEl.textContent = marker.text.semantic
                    }
                }
            }

            if (block.type === 'thematicBreak') {
                const blockEl = this.rootElement.querySelector(
                    `[data-block-id="${block.id}"]`
                ) as HTMLElement | null
                if (blockEl) {
                    const hrEl = document.createElement('hr')
                    hrEl.classList.add('block', 'thematicBreak')
                    hrEl.id = block.id
                    hrEl.dataset.blockId = block.id
                    blockEl.replaceWith(hrEl)
                }
            }
        }
    }
}

export default Focus
