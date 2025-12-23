import { LineState } from "../context/LineState"
import { parseInline } from "../parseInline"
import type { BlockContext } from "../../types"
import type { LinkReference } from "../../types"
import type { ListItem, Paragraph, Document } from "../../types/block"


function tryOpenListItem(
    line: LineState,
    parent: BlockContext,
    startIndex: number,
): BlockContext | null {
    if (parent.type !== "list") return null

    const savedPos = line.pos
    const indent = line.countIndent()
    line.skipIndent(1000)
    let match

    if ((match = line.remaining().match(/^([-*+])\s+/))) {
        line.advance(match[0].length)
    } else if ((match = line.remaining().match(/^(\d+)\.\s+/))) {
        line.advance(match[0].length)
    } else {
        line.pos = savedPos
        return null
    }

    const markerIndent = indent
    const maxContentIndent = markerIndent + 4

    const originalLine = line.text
    const node: ListItem = { 
        type: "listItem", 
        children: [],
        rawText: "",
        startIndex: 0,
        endIndex: 0,
    }
    let previousLineHadContent = false
    let rawText = originalLine

    return {
        type: "listItem",
        node,
        parent,
        startIndex,
        rawText: "",
        canContinue(nextLine) {
            if (nextLine.isBlank()) {
                previousLineHadContent = false
                return true
            }

            const savedNextPos = nextLine.pos
            const nextIndent = nextLine.countIndent()

            const checkLine = new LineState(nextLine.text)
            checkLine.skipIndent(1000)
            const remaining = checkLine.remaining()
            const hasListMarker = !!(
                remaining.match(/^([-*+])\s+/) || remaining.match(/^(\d+)\.\s+/)
            )

            if (hasListMarker && nextIndent <= markerIndent) {
                nextLine.pos = savedNextPos
                return false
            }

            if (hasListMarker && nextIndent > markerIndent) {
                nextLine.pos = savedNextPos
                previousLineHadContent = true
                return true
            }

            if (previousLineHadContent && nextIndent <= maxContentIndent) {
                nextLine.pos = savedNextPos
                return true
            }

            if (nextIndent > markerIndent && nextIndent <= maxContentIndent) {
                nextLine.pos = savedNextPos
                previousLineHadContent = true
                return true
            }

            if (nextIndent > maxContentIndent) {
                nextLine.pos = savedNextPos
                previousLineHadContent = true
                return true
            }

            if (nextIndent < markerIndent) {
                nextLine.pos = savedNextPos
                return false
            }

            if (nextIndent >= markerIndent && nextIndent <= maxContentIndent) {
                nextLine.pos = savedNextPos
                previousLineHadContent = true
                return true
            }

            nextLine.pos = savedNextPos
            return false
        },
        addLine(text, originalLine) {
            previousLineHadContent = true
            const lineIndent = new LineState(text).countIndent()
            const indentToRemove = Math.min(lineIndent, maxContentIndent)
            const content = text.slice(indentToRemove)

            const contentStartInLine = indentToRemove
            const lineStartInText = startIndex + rawText.length

            if (
                node.children.length === 0 ||
                node.children[node.children.length - 1].type !== "paragraph"
            ) {
                const para: Paragraph & { rawText?: string; _paraStartIndex?: number } = { 
                    type: "paragraph", 
                    children: [],
                    rawText: "",
                    startIndex: 0,
                    endIndex: 0,
                }
                para.rawText = content
                para._paraStartIndex = lineStartInText + contentStartInLine
                node.children.push(para)
            } else {
                const lastPara = node.children[node.children.length - 1] as Paragraph & { rawText?: string; _paraStartIndex?: number }
                lastPara.rawText = (lastPara.rawText || "") + " " + content
            }
            rawText += "\n" + originalLine
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

            for (const child of node.children) {
                if (child.type === "paragraph") {
                    const para = child as Paragraph & { _paraStartIndex?: number }
                    const paraStartIndex = para._paraStartIndex || startIndex
                    para.children = parseInline(
                        para.rawText.trim(),
                        linkRefs,
                        paraStartIndex,
                    )

                    delete para._paraStartIndex
                }
            }
            node.rawText = rawText
            node.startIndex = startIndex
            node.endIndex = endIndex
        },
    }
}

export { tryOpenListItem }
