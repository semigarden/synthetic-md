import BlockRender from './blockRender'
import { normalizeTables } from './tableNormalizer'
import type { Block, RenderEffect, RenderPosition } from '../../types'

class Render {
    private rootElement: HTMLElement
    private blockRender: BlockRender

    constructor(rootElement: HTMLElement) {
        this.rootElement = rootElement
        this.blockRender = new BlockRender()
    }

    public renderBlocks(blocks: Block[], rootElement: HTMLElement = this.rootElement) {
        this.blockRender.renderBlocks(blocks, rootElement)
    }

    public renderBlock(
        block: Block,
        parentElement: HTMLElement = this.rootElement,
        renderAt: RenderPosition = 'current',
        targetBlock: Block | null = null
    ): HTMLElement {
        return this.blockRender.renderBlock(block, parentElement, renderAt, targetBlock)
    }

    public apply(effects: RenderEffect[]) {
        for (const effect of effects) {
            switch (effect.type) {
                case 'update':
                    const removedIds = new Set<string>()
                    effect.render.remove.forEach(block => {
                        if (removedIds.has(block.id)) return
                        const removeBlockElement = this.rootElement.querySelector(
                            `[data-block-id="${block.id}"]`
                        ) as HTMLElement | null
                        if (removeBlockElement) {
                            removeBlockElement.remove()
                            removedIds.add(block.id)
                        }
                    })

                    effect.render.insert.forEach(render => {
                        this.renderBlock(render.current, this.rootElement, render.at, render.target)
                    })

                    normalizeTables(this.rootElement)
                    break
                case 'input':
                    console.log('input', effect.input)
                    effect.input.forEach(input => {
                        const block = this.rootElement.querySelector(`[data-block-id="${input.blockId}"]`) as HTMLElement | null
                        if (!block) return

                        const inline = block.querySelector(`[data-inline-id="${input.inlineId}"]`) as HTMLElement | null
                        if (!inline) return
                    

                        switch (input.type) {
                            case 'codeBlockMarker':
                                block.setAttribute('data-language', input.language)
                                inline.textContent = input.text
                                break
                            case 'text':
                                inline.textContent = input.text
                                break
                        }
                    })
                    break
                // case 'deleteBlock':
                //     effect.deleteBlock.forEach(deleteBlock => {
                //         const block = this.rootElement.querySelector(`[data-block-id="${deleteBlock.blockId}"]`) as HTMLElement | null
                //         if (!block) return
                //         block.remove()
                //     })
                //     break
                case 'deleteInline':
                    effect.deleteInline.forEach(deleteInline => {
                        const block = this.rootElement.querySelector(`[data-block-id="${deleteInline.blockId}"]`) as HTMLElement | null
                        if (!block) return

                        const inline = block.querySelector(`[data-inline-id="${deleteInline.inlineId}"]`) as HTMLElement | null
                        if (!inline) return
                        inline.remove()
                    })
                    break
            }
        }
    }
}

export default Render
