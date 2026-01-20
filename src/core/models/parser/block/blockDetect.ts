import type { DetectedBlock } from '../../../types'

function detectBlockType(line: string): DetectedBlock {
    line = line
        .replace(/[\u200B\u200C\u200D\uFEFF]/g, '')
        .replace(/\r$/, '')

    const trimmed = line.trim()

    if (trimmed === '') return { type: 'blankLine' }

    const headingMatch = trimmed.match(/^(#{1,6})(?:\s+(.*))?$/)
    if (headingMatch) return { type: 'heading', level: headingMatch[1].length }

    if (/^>/.test(line)) return { type: 'blockQuote' }

    if (/^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/.test(line)) return { type: 'thematicBreak' }

    if (/^\s{0,3}(```+|~~~+)/.test(line)) return { type: 'codeBlock' }

    const taskListMatch = /^\s*([-*+])\s+\[([ xX])\](?:\s+|$)/.exec(line)
    if (taskListMatch) {
        return {
            type: 'taskListItem',
            ordered: false,
            checked: taskListMatch[2].toLowerCase() === 'x',
        }
    }

    const unorderedListMatch = /^\s*([-*+])\s+/.exec(line)
    if (unorderedListMatch) return { type: 'listItem', ordered: false }

    const orderedListMatch = /^\s*(\d{1,9})([.)])\s+/.exec(line)
    if (orderedListMatch) {
        return {
            type: 'listItem',
            ordered: true,
            listStart: parseInt(orderedListMatch[1], 10),
        }
    }

    if (/^ {4,}[^ ]/.test(line)) return { type: 'codeBlock' }

    if (/^\[\^[^\]]+\]:/.test(trimmed)) return { type: 'footnote' }

    if (
        /^\s{0,3}<(?:script|pre|style|textarea)[\s>]/i.test(line) ||
        /^\s{0,3}<!--/.test(line) ||
        /^\s{0,3}<\?/.test(line) ||
        /^\s{0,3}<![A-Z]/.test(line) ||
        /^\s{0,3}<!\[CDATA\[/.test(line) ||
        /^\s{0,3}<\/?(?:address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h1|h2|h3|h4|h5|h6|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)(?:\s|\/?>|$)/i.test(
            line
        )
    ) {
        return { type: 'htmlBlock' }
    }

    // link reference definitions are handled elsewhere, treat as paragraph
    if (/^\s{0,3}\[([^\]]+)\]:\s*/.test(line)) return { type: 'paragraph' }

    return { type: 'paragraph' }
}

export { detectBlockType }
