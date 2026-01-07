import { renderBlock } from "../render/renderBlock"
import { RenderEffect } from "../types"

class Render {
    constructor(
        private rootElement: HTMLElement,
    ) {}

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
                break
        }
    }
}

export default Render
