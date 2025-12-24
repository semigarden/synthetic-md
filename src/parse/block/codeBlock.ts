import type { BlockContext } from "../../types"
import type { LineState } from "../context/LineState"
import type { CodeBlock } from "../../types/block"
import { isContainerBlock, isLeafBlockType } from "../context/BlockContext"
import { uuid } from "../../utils"

function tryOpenCodeBlock(
    line: LineState,
    parent: BlockContext,
    startIndex: number,
): BlockContext | null {
    if (!isContainerBlock(parent.node)) return null
    if (isLeafBlockType(parent.type)) return null

    const text = line.remaining()
    const match = text.match(/^([`~]{3,})(\w*)\s*$/)
    if (!match) return null

    const fence = match[1]
    const language = match[2] || ""

    const originalLine = line.text
    const node: CodeBlock = {
        id: uuid(),
        type: "codeBlock",
        children: [],
        language,
        code: "",
        rawText: "",
        startIndex: 0,
        endIndex: 0,
    }

    line.advance(text.length)
    let rawText = originalLine

    return {
        type: "codeBlock",
        node,
        parent,
        startIndex,
        rawText: "",
        canContinue(nextLine) {
            const remaining = nextLine.remaining()
            const fenceChar = fence[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
            return !remaining.match(
                new RegExp(`^${fenceChar}{${fence.length},}\\s*$`),
            )
        },
        addLine(text, originalLine) {
            node.code += (node.code ? "\n" : "") + text
            rawText += "\n" + originalLine
        },
        finalize(endIndex) {
            node.code = node.code.trimEnd()
            node.rawText = rawText
            node.startIndex = startIndex
            node.endIndex = endIndex
        },
    }
}

export { tryOpenCodeBlock }
