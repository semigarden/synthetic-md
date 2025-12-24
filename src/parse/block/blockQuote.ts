import { isContainerBlock } from "../context/BlockContext"
import { LineState } from "../context/LineState"
import type { BlockContext } from "../../types"
import type { BlockQuote } from "../../types/block"
import { uuid } from "../../utils"

function tryOpenBlockQuote(
    line: LineState,
    parent: BlockContext,
    startIndex: number,
): BlockContext | null {
    if (!isContainerBlock(parent.node)) return null
    if (line.peek() !== ">") return null

    line.advance(1)
    if (line.peek() === " ") line.advance(1)

    const originalLine = line.text
    const node: BlockQuote = {
        id: uuid(),
        type: "blockQuote",
        children: [],
        rawText: "",
        startIndex: 0,
        endIndex: 0,
    }

    let previousLineHadMarker = true
    let rawText = originalLine

    return {
        type: "blockQuote",
        node,
        parent,
        startIndex,
        rawText: "",
        canContinue(nextLine) {
            if (nextLine.isBlank()) {
                previousLineHadMarker = false
                return false
            }
            if (nextLine.peek() === ">") {
                previousLineHadMarker = true
                return true
            }
            if (previousLineHadMarker) {
                return true
            }
            return false
        },
        addLine(_text, originalLine) {
            previousLineHadMarker = originalLine.trimStart().startsWith(">")
            rawText += "\n" + originalLine
        },
        finalize(endIndex) {
            node.rawText = rawText
            node.startIndex = startIndex
            node.endIndex = endIndex
        },
    }
}

export { tryOpenBlockQuote }
