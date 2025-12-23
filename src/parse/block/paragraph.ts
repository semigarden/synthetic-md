import { LineState } from "../context/LineState"
import { isContainerBlock, wouldOpenBlock } from "../context/BlockContext"
import { parseInlineWithBreaks } from "../parseInline"
import type { Paragraph, Document } from "../../types/block"
import type { BlockContext, LinkReference } from "../../types"

function tryOpenParagraph(
    line: LineState,
    parent: BlockContext,
    startIndex: number,
): BlockContext | null {
    if (!isContainerBlock(parent.node)) return null
    if (parent.type === "paragraph") return null
    if (line.isBlank()) return null

    const originalLine = line.text
    const node: Paragraph = {
        type: "paragraph",
        children: [],
        rawText: "",
        startIndex: 0,
        endIndex: 0,
    }

    const lines: Array<{ text: string; hardBreak: boolean; originalLine: string; lineStartIndex: number }> = []
    let rawText = originalLine
    let currentLineIndex = startIndex

    return {
        type: "paragraph",
        node,
        parent,
        startIndex,
        rawText: "",
        canContinue(nextLine) {
            if (nextLine.isBlank()) return false

            const setextMatch = nextLine
                .remaining()
                .trim()
                .match(/^(=+|-+)\s*$/)
            if (setextMatch && setextMatch[1].length >= 3) {
                return true
            }

            const indent = nextLine.countIndent()
            if (indent >= 4 && !nextLine.isBlank()) {
                const checkLine = new LineState(nextLine.text)
                checkLine.skipIndent(4)
                const remaining = checkLine.remaining()

                if (
                    !remaining.match(/^([-*+]|\d+\.)\s+/) &&
                    !remaining.startsWith(">")
                ) {
                    return false
                }
            }

            if (wouldOpenBlock(nextLine, parent, 0)) return false

            if (parent.type === "listItem" || parent.type === "list") {
                const savedPos = nextLine.pos
                nextLine.skipIndent(1000)
                const hasListMarker = !!(
                    nextLine.remaining().match(/^([-*+])\s+/) ||
                    nextLine.remaining().match(/^(\d+)\.\s+/)
                )
                nextLine.pos = savedPos
                if (hasListMarker) {
                    return false
                }
            }

            return false
        },
        addLine(text, originalLine) {
            let hardBreak = false
            let lineText = text
            if (text.endsWith("\\")) {
                lineText = text.slice(0, -1)
                hardBreak = true
            } else if (text.endsWith("  ")) {
                lineText = text.slice(0, -2)
                hardBreak = true
            }
            const lineStartIndex = currentLineIndex
            lines.push({ text: lineText, hardBreak, originalLine, lineStartIndex })
            rawText += (rawText ? "\n" : "") + originalLine
            currentLineIndex += originalLine.length + 1
        },
        finalize(endIndex) {
            let doc: BlockContext | null = parent
            while (doc && doc.type !== "document") {
                doc = doc.parent
            }
            const linkRefs = doc?.node && doc.node.type === "document"
                ? ((doc.node as Document & { __linkReferences?: Map<string, LinkReference> }).__linkReferences as
                      | Map<string, LinkReference>
                      | undefined)
                : undefined
            node.children = parseInlineWithBreaks(lines, linkRefs)
            node.rawText = rawText
            node.startIndex = startIndex
            node.endIndex = endIndex
        },
    }
}

export { tryOpenParagraph }
