import { LineState } from "../context/LineState"
import { isContainerBlock, isLeafBlockType } from "../context/BlockContext"
import type { BlockContext } from "../../types"
import type { LineBreak } from "../../types/block"
import { uuid } from "../../utils"

function tryOpenLineBreak(
    line: LineState,
    parent: BlockContext,
    startIndex: number,
): BlockContext | null {
    if (!isContainerBlock(parent.node)) return null
    if (isLeafBlockType(parent.type)) return null
    if (!line.isBlank()) return null

    const originalLine = line.text
    const node: LineBreak = {
        id: uuid(),
        type: "lineBreak",
        children: [],
        rawText: originalLine,
        startIndex: 0,
        endIndex: 0,
    }

    return {
        type: "lineBreak",
        node,
        parent,
        startIndex,
        rawText: originalLine,
        canContinue() {
            return false
        },
        addLine() {},
        finalize(endIndex) {
            node.rawText = originalLine
            node.startIndex = startIndex
            node.endIndex = endIndex
        },
    }
}

export { tryOpenLineBreak }
