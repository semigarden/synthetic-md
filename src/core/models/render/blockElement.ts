import type { Block } from '../../types'

function createBlockElement(block: Block): HTMLElement {
    switch (block.type) {
        case 'paragraph': {
            const element = document.createElement('p')
            element.classList.add('paragraph')
            return element
        }

        case 'heading': {
            const element = document.createElement(`h${block.level ?? 1}`)
            element.classList.add(`h${block.level ?? 1}`)
            return element
        }

        case 'codeBlock': {
            const element = document.createElement('pre')
            element.classList.add('codeBlock')
            return element
        }

        case 'blockQuote': {
            const element = document.createElement('blockquote')
            element.classList.add('blockQuote')
            return element
        }

        case 'list': {
            const element = document.createElement(block.ordered ? 'ol' : 'ul')
            element.classList.add('list')
            return element
        }

        case 'listItem': {
            const element = document.createElement('li')
            element.classList.add('listItem')
            return element
        }

        case 'taskListItem': {
            const element = document.createElement('li')
            element.classList.add('taskListItem')
            return element
        }

        case 'table': {
            const element = document.createElement('table')
            element.classList.add('table')
            return element
        }

        case 'tableRow': {
            const element = document.createElement('tr')
            element.classList.add('tableRow')
            return element
        }

        case 'tableCell': {
            const element = document.createElement('td')
            element.classList.add('tableCell')
            return element
        }

        case 'tableHeader': {
            const element = document.createElement('th')
            element.classList.add('tableCell')
            return element
        }

        case 'thematicBreak': {
            const element = document.createElement('hr')
            element.classList.add('thematicBreak')
            return element
        }

        default: {
            return document.createElement('div')
        }
    }
}

export { createBlockElement }
