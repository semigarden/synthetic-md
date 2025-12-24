import { LineState } from "../context/LineState"
import { isContainerBlock, isLeafBlockType } from "../context/BlockContext"
import { decodeHTMLEntity } from "../../utils/htmlEntities"
import type { BlockContext } from "../../types"
import type { HTMLBlock } from "../../types/block"
import { uuid } from "../../utils"

function tryOpenHTMLBlock(
    line: LineState,
    parent: BlockContext,
    startIndex: number,
): BlockContext | null {
    if (!isContainerBlock(parent.node)) return null
    if (isLeafBlockType(parent.type)) return null

    const text = line.remaining().trim()
    const htmlBlockPattern =
        /^<(script|pre|style|textarea|iframe|object|embed|applet|noembed|noscript|form|fieldset|math|svg|table|hr|br|p|div|h[1-6]|ul|ol|dl|li|blockquote|address|article|aside|details|figcaption|figure|footer|header|hgroup|main|nav|section|summary)(\s|>|\/)/i
    if (!htmlBlockPattern.test(text)) return null

    const originalLine = line.text
    const node: HTMLBlock = {
        id: uuid(),
        type: "htmlBlock",
        children: [],
        html: "",
        rawText: "",
        startIndex: 0,
        endIndex: 0,
    }

    let rawText = originalLine

    return {
        type: "htmlBlock",
        node,
        parent,
        startIndex,
        rawText: "",
        canContinue(nextLine) {
            if (nextLine.isBlank()) return false
            const remaining = nextLine.remaining().trim()
            return remaining.startsWith("<") || remaining.length > 0
        },
        addLine(text, originalLine) {
            node.html += (node.html ? "\n" : "") + decodeHTMLEntity(text)
            rawText += "\n" + originalLine
        },
        finalize(endIndex) {
            node.html = node.html.trim()
            node.rawText = rawText
            node.startIndex = startIndex
            node.endIndex = endIndex
        },
    }
}

export { tryOpenHTMLBlock }
