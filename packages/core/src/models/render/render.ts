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

    public apply(effect: RenderEffect) {
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
        }
    }
}

export default Render
