import { Block, Inline, RenderEffect } from "../types"

class Render {
    constructor(private rootElement: HTMLElement) {}

    public render(blocks: Block[], container: HTMLElement = this.rootElement) {
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
                    element = document.createElement(`h${block.level ?? 1}`)
                    element.classList.add(`h${block.level ?? 1}`)
                    break

                case 'codeBlock':
                    element = document.createElement('pre')
                    const code = document.createElement('code')
                    element.appendChild(code)
                    this.renderInlines(block.inlines, code)
                    break

                case 'blockQuote':
                    element = document.createElement('blockquote')
                    element.classList.add('blockQuote')
                    break

                case 'list':
                    element = document.createElement(block.ordered ? 'ol' : 'ul')
                    element.classList.add('list')
                    break

                case 'listItem':
                    element = document.createElement('li')
                    element.classList.add('listItem')
                    break

                case 'table':
                    element = document.createElement('table')
                    element.classList.add('table')
                    break
                
                case 'tableRow':
                    element = document.createElement('tr')
                    element.classList.add('tableRow')
                    break
                
                case 'tableCell':
                    element = document.createElement('td')
                    element.classList.add('tableCell')
                    break
                
                case 'tableHeader':
                    element = document.createElement('th')
                    element.classList.add('tableCell')
                    break

                case 'thematicBreak':
                    element = document.createElement('hr')
                    element.classList.add('thematicBreak')
                    break

                default:
                    element = document.createElement('div')
            }
            
            element.dataset.blockId = block.id
            element.id = block.id
            element.classList.add('block')
        }

        switch (block.type) {
            case 'blockQuote':
            case 'list':
            case 'listItem': {
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
                const tableElement = rootElement.closest('table') || rootElement.querySelector('table')
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
            case 'tableHeader':
                for (const child of block.blocks) {
                    this.renderBlock(child, element)
                }
                break
        
            case 'codeBlock':
                const code = element.querySelector('code') as HTMLElement || document.createElement('code')
                code.innerHTML = ''
                this.renderInlines(block.inlines, code)
                if (!element.querySelector('code')) element.appendChild(code)
                break

            case 'thematicBreak':
                break
        
            default:
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

    public renderInlines(inlines: Inline[], parent: HTMLElement) {
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
        inlineElement.classList.add('inline', inline.type)

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
            case 'codeSpan':
                return 'code'
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

                this.recalculateTableColspans()

                break
        }
    }

    private recalculateTableColspans() {
        const tables = this.rootElement.querySelectorAll('table.table')
        
        tables.forEach(table => {
            const rows = table.querySelectorAll(':scope > tr.tableRow')

            let maxCells = 1
            rows.forEach(row => {
                const cellCount = row.querySelectorAll(':scope > td.tableCell').length
                if (cellCount > maxCells) maxCells = cellCount
            })
            
            ;(table as HTMLElement).dataset.maxCells = String(maxCells)

            rows.forEach(row => {
                const cells = row.querySelectorAll(':scope > td.tableCell')
                const rowCellCount = cells.length
                
                cells.forEach(cell => {
                    if (rowCellCount === 1 && maxCells > 1) {
                        cell.setAttribute('colspan', String(maxCells))
                    } else {
                        cell.removeAttribute('colspan')
                    }
                })
            })
        })
    }
}

export default Render
