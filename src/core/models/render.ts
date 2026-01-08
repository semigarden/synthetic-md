import { Block, Inline, RenderEffect } from "../types"

class Render {
    constructor(
        private rootElement: HTMLElement,
    ) {}

    public render(
        blocks: Block[],
        container: HTMLElement
    ) {
        container.replaceChildren()
        for (const block of blocks) {
            container.appendChild(this.renderBlock(block, container))
        }
    }

    public renderBlock(block: Block, rootElement: HTMLElement, renderAt: string = 'current', targetBlock: Block | null = null): HTMLElement {
        let element: HTMLElement = rootElement.querySelector(`[data-block-id="${block.id}"]`) as HTMLElement

        const isNew = !element
        if (element) {
            element.replaceChildren()
        } else {
            switch (block.type) {
                case 'paragraph':
                    element = document.createElement('p')
                    element.classList.add('paragraph')
                    break

                case 'heading':
                    element = document.createElement(`h${block.level}`)
                    element.classList.add(`h${block.level}`)
                    break

                case 'codeBlock':
                    element = document.createElement('pre')
                    const code = document.createElement('code')
                    element.appendChild(code)
                    this.renderInlines(block.inlines, code)
                    break

                case 'list':
                    element = document.createElement(block.ordered ? 'ol' : 'ul')
                    element.classList.add('list')
                    break

                case 'listItem':
                    element = document.createElement('li')
                    element.classList.add('listItem')
                    break

                default:
                    element = document.createElement('div')
            }
            
            element.dataset.blockId = block.id
            element.id = block.id
            element.classList.add('block')
        }

        if (block.type === 'codeBlock') {
            const code = element.querySelector('code') as HTMLElement || document.createElement('code')
            code.innerHTML = ''
            this.renderInlines(block.inlines, code)
            if (!element.querySelector('code')) element.appendChild(code)
        }

        if (block.type === 'list' || block.type === 'listItem') {
            for (const child of block.blocks) {
                this.renderBlock(child, element)
            }
        } else {
            this.renderInlines(block.inlines, element)
        }

        if (isNew) {
            if (targetBlock) {
                const targetBlockElement = rootElement.querySelector(
                `[data-block-id="${targetBlock.id}"]`
                )
                if (targetBlockElement) {
                    switch (renderAt) {
                        case 'current':
                            targetBlockElement.replaceWith(element)
                            break

                        case 'previous':
                            targetBlockElement.before(element)
                            break

                        case 'next':
                            targetBlockElement.after(element)
                            break
                    }
                } else {
                    rootElement.appendChild(element)
                }
            } else {
                rootElement.appendChild(element)
            }
        }

        return element
    }

    public renderInlines(
        inlines: Inline[],
        parent: HTMLElement,
    ) {
        parent.replaceChildren()
    
        for (const inline of inlines) {
            parent.appendChild(this.renderInline(inline))
        }
    }
    
    private renderInline(inline: Inline): Node {
        const tag = this.getInlineTag(inline)
        const inlineElement = document.createElement(tag)
        inlineElement.id = inline.id
        inlineElement.dataset.inlineId = inline.id
        inlineElement.textContent = inline.text.semantic
        inlineElement.contentEditable = 'true'
        inlineElement.classList.add('inline')

        if (inline.type === 'link') {
            (inlineElement as HTMLAnchorElement).href = inline.url || '';
            (inlineElement as HTMLAnchorElement).title = inline.title || '';
        }

        if (inline.type === 'autolink') {
            (inlineElement as HTMLAnchorElement).href = inline.url || '';
        }

        if (inline.type === 'image') {
            (inlineElement as HTMLImageElement).src = inline.url || '';
            (inlineElement as HTMLImageElement).alt = inline.alt || '';
            (inlineElement as HTMLImageElement).title = inline.title || '';
            inlineElement.textContent = '';
        }

        // if (inline.type === 'strikethrough') {
        //     inlineElement.classList.add('strikethrough')
        // }

        // if (inline.type === 'emphasis') {
        //     inlineElement.classList.add('emphasis')
        // }
    
        return inlineElement
    }
    
    private getInlineTag(inline: Inline): string {
        switch (inline.type) {
            case 'text':
                return 'span'
            case 'emphasis':
                return 'em'
            case 'strong':
                return 'strong'
            case 'link':
                return 'a'
            case 'autolink':
                return 'a'
            case 'image':
                return 'img'
            case 'strikethrough':
                return 's'
            default:
                return 'span'
        }
    }

    public apply(effect: RenderEffect) {
        switch (effect.type) {
            case 'update':
                effect.render.insert.forEach(render => {
                    this.renderBlock(render.current, this.rootElement, render.at, render.target)
                })

                effect.render.remove.forEach(block => {
                    const removeBlockElement = this.rootElement.querySelector(`[data-block-id="${block.id}"]`)
                    if (removeBlockElement) removeBlockElement.remove()
                })

                break
        }
    }
}

export default Render
