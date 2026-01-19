import type { Block, Inline, RenderPosition } from '../../types'
import { createBlockElement } from './blockElement'
import { renderInlines } from './inlineRender'

type Deps = {
    createBlockElement: (block: Block) => HTMLElement
    renderInlines: (inlines: Inline[], parent: HTMLElement) => void
}

class BlockRender {
    private deps: Deps

    constructor(deps?: Partial<Deps>) {
        this.deps = {
            createBlockElement,
            renderInlines,
            ...deps,
        } as Deps
    }

    public renderBlocks(blocks: Block[], rootElement: HTMLElement) {
        rootElement.replaceChildren()
        blocks.forEach(block => {
            this.renderBlock(block, rootElement, 'next', null)
        })
    }

    public renderBlock(
        block: Block,
        parentElement: HTMLElement,
        renderAt: RenderPosition = 'current',
        targetBlock: Block | null = null
    ): HTMLElement {
        const { element, isNew } = this.getOrCreateBlockElement(block, parentElement)

        this.renderByType(block, element)

        this.mountIfNew({
            isNew,
            element,
            parentElement,
            renderAt,
            targetBlock,
        })

        return element
    }

    private getOrCreateBlockElement(
        block: Block,
        parentElement: HTMLElement
    ): { element: HTMLElement; isNew: boolean } {
        let element = parentElement.querySelector(
            `[data-block-id="${block.id}"]`
        ) as HTMLElement | null

        const isNew = !element

        if (element) {
            element.replaceChildren()
            element.className = ''
            element.classList.add('block', block.type)
        } else {
            element = this.deps.createBlockElement(block)
            element.dataset.blockId = block.id
            element.id = block.id
            element.classList.add('block')
            // element.contentEditable = 'false'
        }

        return { element, isNew }
    }

    private renderByType(block: Block, element: HTMLElement) {
        switch (block.type) {
            case 'blockQuote':
            case 'list':
            case 'listItem':
            case 'taskListItem': {
                if (block.type === 'taskListItem') {
                    const cb = document.createElement('input')
                    cb.type = 'checkbox'
                    cb.classList.add('taskCheckbox')
                    cb.checked = !!(block as any).checked
                    cb.tabIndex = -1
            
                    cb.addEventListener('mousedown', e => e.preventDefault())
                    cb.addEventListener('click', e => e.preventDefault())
            
                    element.appendChild(cb)
                }

                for (const child of block.blocks) {
                    if (child.type !== 'list') {
                        this.renderBlock(child, element)
                    }
                }

                const nestedList = block.blocks.find(b => b.type === 'list')
                if (nestedList) {
                    this.renderBlock(nestedList, element)
                }
                break
            }

            case 'table': {
                const cellCounts = block.blocks.map(r => ('blocks' in r ? r.blocks?.length : 0) ?? 0)
                const maxCells = cellCounts.length > 0 ? Math.max(...cellCounts) : 1
                element.dataset.maxCells = String(maxCells)

                for (const child of block.blocks) {
                    this.renderBlock(child, element)
                }
                break
            }

            case 'tableRow': {
                const tableElement = element.closest('table')
                const maxCells = parseInt(tableElement?.dataset.maxCells ?? '1', 10)
                const rowCellCount = block.blocks?.length ?? 0

                for (const child of block.blocks) {
                    const cellElement = this.renderBlock(child, element)

                    if (rowCellCount === 1 && maxCells > 1) {
                        cellElement.setAttribute('colspan', String(maxCells))
                    } else {
                        cellElement.removeAttribute('colspan')
                    }
                }
                break
            }

            case 'tableCell':
            case 'tableHeader': {
                for (const child of block.blocks) {
                    this.renderBlock(child, element)
                }
                break
            }

            case 'codeBlock': {
                const existing = element.querySelector('code') as HTMLElement | null
                const code = existing || document.createElement('code')
                code.innerHTML = ''
                this.deps.renderInlines(block.inlines, code)
                if (!existing) element.appendChild(code)
                break
            }

            default:
                this.deps.renderInlines(block.inlines, element)
        }
    }

    private mountIfNew(args: {
        isNew: boolean
        element: HTMLElement
        parentElement: HTMLElement
        renderAt: RenderPosition
        targetBlock: Block | null
    }) {
        const { isNew, element, parentElement, renderAt, targetBlock } = args
        if (!isNew) return

        if (targetBlock) {
            const targetBlockElement = parentElement.querySelector(
                `[data-block-id="${targetBlock.id}"]`
            )

            if (targetBlockElement) {
                switch (renderAt) {
                    case 'current':
                        targetBlockElement.replaceWith(element)
                        return
                    case 'previous':
                        targetBlockElement.before(element)
                        return
                    case 'next':
                        targetBlockElement.after(element)
                        return
                }
            }

            parentElement.appendChild(element)
            return
        }

        parentElement.appendChild(element)
    }
}

export default BlockRender
