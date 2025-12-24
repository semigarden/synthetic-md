import { LineState } from "../context/LineState"
import type { BlockContext } from "../../types"
import type { List } from "../../types/block"
import { uuid } from "../../utils"

function tryOpenList(
    line: LineState,
    parent: BlockContext,
    startIndex: number,
): BlockContext | null {
    const savedPos = line.pos
    const indent = line.countIndent()
    line.skipIndent(1000)

    let ordered = false
    let start: number | undefined = undefined

    const unorderedMatch = line.remaining().match(/^([-*+])\s+/)
    const orderedMatch = line.remaining().match(/^(\d+)\.\s+/)

    if (unorderedMatch) {
        ordered = false
    } else if (orderedMatch) {
        ordered = true
        start = parseInt(orderedMatch[1], 10)
    } else {
        line.pos = savedPos
        return null
    }

    line.pos = savedPos

    const originalLine = line.text
    const node: List = { 
        id: uuid(),
        type: "list", 
        children: [], 
        ordered, 
        start,
        rawText: "",
        startIndex: 0,
        endIndex: 0,
    }

    const baseIndent = indent
    let rawText = originalLine

    return {
        type: "list",
        node,
        parent,
        startIndex,
        rawText: "",
        canContinue(nextLine) {
            const savedNextPos = nextLine.pos
            const nextIndent = nextLine.countIndent()

            const checkLine = new LineState(nextLine.text)
            checkLine.skipIndent(1000)
            const remaining = checkLine.remaining()

            let canStartItem = false
            if (ordered) {
                canStartItem = !!remaining.match(/^(\d+)\.\s+/)
            } else {
                canStartItem = !!remaining.match(/^([-*+])\s+/)
            }

            if (parent.type === "listItem") {
                nextLine.pos = savedNextPos
                return canStartItem && nextIndent >= baseIndent
            }

            nextLine.pos = savedNextPos
            return canStartItem
        },
        addLine(_text, originalLine) {
            rawText += "\n" + originalLine
        },
        finalize(endIndex) {
            node.rawText = rawText
            node.startIndex = startIndex
            node.endIndex = endIndex
        },
    }
}

export { tryOpenList }
