import { renderBlock } from "../render/renderBlock"
import { RenderEffect, Block } from "../types"

class Render {
    constructor(
        private rootElement: HTMLElement,
    ) {}

    // private removeEmptyBlocks(blocks: Block[]) {
    //     for (const block of blocks) {
    //         const hasContent =
    //             block.inlines.length > 0 ||
    //             ('blocks' in block && block.blocks.some(b => b.inlines.length > 0 || ('blocks' in b && b.blocks.length > 0)))
    
    //         if (!hasContent) {
    //             const blockEl = this.rootElement!.querySelector(`[data-block-id="${block.id}"]`)
    //             if (blockEl) blockEl.remove()
    
    //             const parentBlock = this.ast.getParentBlock(block)
    //             if (parentBlock && 'blocks' in parentBlock) {
    //                 const idx = parentBlock.blocks.findIndex(b => b.id === block.id)
    //                 if (idx !== -1) parentBlock.blocks.splice(idx, 1)
    //             } else {
    //                 const idx = this.ast.ast.blocks.findIndex(b => b.id === block.id)
    //                 if (idx !== -1) this.ast.ast.blocks.splice(idx, 1)
    //             }

    //             if (parentBlock) {
    //                 this.removeEmptyBlocks([parentBlock])
    //             }
    //         }
    //     }
    // }

    public apply(effect: RenderEffect) {
        switch (effect.type) {
            case 'update':
                effect.render.remove.forEach(block => {
                    const removeBlockElement = this.rootElement.querySelector(`[data-block-id="${block.id}"]`)
                    if (removeBlockElement) removeBlockElement.remove()
                })

                effect.render.insert.forEach(render => {
                    renderBlock(render.current, this.rootElement, null, render.at, render.target)
                })

                // this.removeEmptyBlocks(render.insert.map(render => render.current))
        }
    }
}

export default Render
