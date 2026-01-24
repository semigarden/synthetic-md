import type { OpenBlock, List } from '../../../types'

function continueBlocks(openBlocks: OpenBlock[], line: string): { line: string } {
    for (let i = 0; i < openBlocks.length; i++) {
        const open = openBlocks[i]

        if (open.type === 'blockQuote') {
            const m = /^(\s{0,3})>(?:\s?(.*))?$/.exec(line)
            if (m) {
                line = m[2] ?? ''
                continue
            }
            openBlocks.splice(i)
            break
        }

        if (open.type === 'listItem') {
            if (/^\s+([-*+]|\d+[.)])\s/.test(line)) continue

            if (line.startsWith(' '.repeat(open.indent))) {
                line = line.slice(open.indent)
                continue
            }

            openBlocks.splice(i)
            break
        }

        if (open.type === 'list') {
            const list = open.block as List
            const m = /^(\s*)([-*+]|(\d+[.)]))\s+/.exec(line)
            if (!m) {
                openBlocks.splice(i)
                break
            }

            const isOrdered = !!m[3]
            if (list.ordered !== isOrdered) {
                openBlocks.splice(i)
                break
            }

            continue
        }
    }

    return { line }
}

export { continueBlocks }
