import { Block, Inline, RenderEffect, RenderPosition } from '../types'

class Render {
    private rootElement: HTMLElement
    constructor(rootElement: HTMLElement) {
        this.rootElement = rootElement
    }

    private createBlock(block: Block): HTMLElement {
        switch (block.type) {
            case 'paragraph':
                const paragraph = document.createElement('p')
                paragraph.classList.add('paragraph')
                return paragraph

            case 'heading':
                const heading = document.createElement(`h${block.level ?? 1}`)
                heading.classList.add(`h${block.level ?? 1}`)
                return heading

            case 'codeBlock':
                const codeBlock = document.createElement('pre')
                codeBlock.classList.add('codeBlock')
                return codeBlock

            case 'blockQuote':
                const blockquote = document.createElement('blockquote')
                blockquote.classList.add('blockQuote')
                return blockquote

            case 'list':
                const list = document.createElement(block.ordered ? 'ol' : 'ul')
                list.classList.add('list')
                return list

            case 'listItem':
                const listItem = document.createElement('li')
                listItem.classList.add('listItem')
                return listItem

            case 'table':
                const table = document.createElement('table')
                table.classList.add('table')
                return table
            
            case 'tableRow':
                const tableRow = document.createElement('tr')
                tableRow.classList.add('tableRow')
                return tableRow
            
            case 'tableCell':
                const tableCell = document.createElement('td')
                tableCell.classList.add('tableCell')
                return tableCell
            
            case 'tableHeader':
                const tableHeader = document.createElement('th')
                tableHeader.classList.add('tableCell')
                return tableHeader

            case 'thematicBreak':
                const thematicBreak = document.createElement('hr')
                thematicBreak.classList.add('thematicBreak')
                return thematicBreak

            default:
                const element = document.createElement('div')
                return element
        }
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

    public renderBlocks(blocks: Block[], rootElement: HTMLElement = this.rootElement) {
        rootElement.replaceChildren()
        blocks.forEach(block => {
            this.renderBlock(block, rootElement, 'next', null)
        })
    }

    public renderBlock(block: Block, parentElement: HTMLElement = this.rootElement, renderAt: RenderPosition = 'current', targetBlock: Block | null = null): HTMLElement {
        let element: HTMLElement = parentElement.querySelector(`[data-block-id="${block.id}"]`) as HTMLElement

        const isNew = !element
        if (element) {
            element.replaceChildren()
        } else {
            element = this.createBlock(block)
            element.dataset.blockId = block.id
            element.id = block.id
            element.classList.add('block')
            element.contentEditable = 'false'
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
                const targetBlockElement = parentElement.querySelector(
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
                    parentElement.appendChild(element)
                }
            } else {
                parentElement.appendChild(element)
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
        inlineElement.contentEditable = 'false'
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

                this.normalizeTables()

                break
        }
    }

    private normalizeTables() {
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
