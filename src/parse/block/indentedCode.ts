import { isContainerBlock, isLeafBlockType } from "../context/BlockContext"
import { LineState } from "../context/LineState"
import type { BlockContext } from "../../types"
import type { CodeBlock } from "../../types/block"
import { uuid } from "../../utils"

function tryOpenIndentedCodeBlock(
    line: LineState,
    parent: BlockContext,
    startIndex: number,
): BlockContext | null {
    if (!isContainerBlock(parent.node)) return null
    if (isLeafBlockType(parent.type)) return null

    const indent = line.countIndent()
    if (indent < 4) return null

    const checkLine = new LineState(line.text)
    checkLine.skipIndent(4)
    const remaining = checkLine.remaining()
    if (remaining.match(/^([-*+]|\d+\.)\s+/) || remaining.startsWith(">")) {
        return null
    }

    const originalLine = line.text
    const node: CodeBlock = {
        id: uuid(),
        type: "codeBlock",
        children: [],
        language: "",
        code: "",
        rawText: "",
        startIndex: 0,
        endIndex: 0,
    }

    let rawText = originalLine

    return {
        type: "codeBlock",
        node,
        parent,
        startIndex,
        rawText: "",
        canContinue(nextLine) {
            if (nextLine.isBlank()) {
                return true
            }

            const nextIndent = nextLine.countIndent()
            if (nextIndent >= 4) {
                const checkNextLine = new LineState(nextLine.text)
                checkNextLine.skipIndent(4)
                const nextRemaining = checkNextLine.remaining()
                if (
                    nextRemaining.match(/^([-*+]|\d+\.)\s+/) ||
                    nextRemaining.startsWith(">")
                ) {
                    return false
                }
                return true
            }
            return false
        },
        addLine(text, originalLine) {
            const lineState = new LineState(text)
            const indent = lineState.countIndent()
            const indentToRemove = Math.min(4, indent)
            const content = text.slice(indentToRemove)
            node.code += (node.code ? "\n" : "") + content
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

export { tryOpenIndentedCodeBlock }
