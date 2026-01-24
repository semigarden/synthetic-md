import { uuid } from '../../../utils/utils'
import type { Block, CodeBlock, DetectedBlock, List, ListItem, TaskListItem } from '../../../types'

function buildHeading(line: string, start: number, end: number, level: number): Block {
    return {
        id: uuid(),
        type: 'heading',
        level,
        text: line,
        position: { start, end },
        inlines: [],
    }
}

function buildThematicBreak(line: string, start: number, end: number): Block {
    return {
        id: uuid(),
        type: 'thematicBreak',
        text: line,
        position: { start, end },
        inlines: [],
    }
}

function buildParagraph(line: string, start: number, end: number): Block {
    return {
        id: uuid(),
        type: 'paragraph',
        text: line,
        position: { start, end },
        inlines: [],
    }
}

function buildBlockQuote(
    originalLine: string,
    start: number,
    end: number,
    innerBlocks: Block[]
): Block {
    const match = /^(\s{0,3}>\s?)/.exec(originalLine)
    if (!match) throw new Error('Invalid block quote line')

    const markerText = match[1]

    return {
        id: uuid(),
        type: 'blockQuote',
        text: markerText,
        position: { start, end },
        blocks: innerBlocks,
        inlines: [],
    }
}

function buildFencedCodeBlock(
    start: number,
    end: number,
    fence: string,
    language: string | undefined,
    indent: number,
    infoString?: string
): CodeBlock {
    return {
        id: uuid(),
        type: 'codeBlock',
        text: '',
        language,
        isFenced: true,
        fenceChar: fence.charAt(0) as '`' | '~',
        fenceLength: fence.length,
        openIndent: indent,
        infoString,
        position: { start, end },
        inlines: [],
    }
}

function buildIndentedCodeBlock(line: string, start: number, end: number): CodeBlock {
    return {
        id: uuid(),
        type: 'codeBlock',
        text: line.replace(/^ {4}/, ''),
        isFenced: false,
        position: { start, end },
        inlines: [],
    }
}

function buildListFromItem(
    line: string,
    start: number,
    end: number,
    detected: DetectedBlock
  ): Block {
    // task: '- [ ] ' / '- [x] ' (also * +)
    const taskMatch = /^(\s*[-*+])\s+\[([ xX])\]\s+/.exec(line)
  
    // normal list: '- ' / '* ' / '+ ' / '1. ' / '1) '
    const listMatch = /^(\s*([-*+]|(\d+[.)])))\s+/.exec(line)
  
    const isTask = !!taskMatch
    const markerText = isTask ? taskMatch![0] : (listMatch ? listMatch[0] : '')
    const markerLength = markerText.length
  
    const bodyText = line.slice(markerLength)
  
    const paragraph: Block = {
        id: uuid(),
        type: 'paragraph',
        text: bodyText,
        position: { start: start + markerLength, end },
        inlines: [],
    }
  
    const item = isTask
      ? ({
            id: uuid(),
            type: 'taskListItem',
            checked: taskMatch![2].toLowerCase() === 'x',
            text: markerText,
            position: { start, end },
            blocks: [paragraph],
            inlines: [],
        } as TaskListItem)
    : ({
            id: uuid(),
            type: 'listItem',
            text: markerText,
            position: { start, end },
            blocks: [paragraph],
            inlines: [],
        } as ListItem)
  
    return {
        id: uuid(),
        type: 'list',
        text: '',
        position: { start, end },
        ordered: !!detected.ordered,
        listStart: detected.listStart,
        tight: true,
        blocks: [item],
        inlines: [],
    } as List
}

export { buildHeading, buildThematicBreak, buildParagraph, buildBlockQuote, buildFencedCodeBlock, buildIndentedCodeBlock, buildListFromItem }
