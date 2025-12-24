import { LineState } from "../context/LineState"
import { isContainerBlock, isLeafBlockType } from "../context/BlockContext"
import type { BlockContext } from "../../types"
import type { ThematicBreak } from "../../types/block"
import { uuid } from "../../utils"

function tryOpenThematicBreak(
    line: LineState,
    parent: BlockContext,
    startIndex: number,
): BlockContext | null {
    if (!isContainerBlock(parent.node)) return null
    if (isLeafBlockType(parent.type)) return null

    const text = line.remaining()

    const match = text.match(/^([*\-_])(?:\s*\1){2,}\s*$/)
    if (!match) return null

    const originalLine = line.text
    const node: ThematicBreak = {
        id: uuid(),
        type: "thematicBreak",
        children: [],
        rawText: "",
        startIndex: 0,
        endIndex: 0,
    }

    line.advance(text.length)

    return {
        type: "thematicBreak",
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

export { tryOpenThematicBreak }
