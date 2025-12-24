
import { LineState } from "./context/LineState"
import { isContainerBlock } from "./context/BlockContext"
import { parseLinkReferenceDefinition } from "./block/linkReferenceDefinition"
import { tryOpenList } from "./block/list"
import { tryOpenListItem } from "./block/listItem"
import { tryOpenBlock, closeBlock } from "./context/BlockContext"
import type { BlockContext, LinkReference } from "../types"
import type {
    Block,
    Document,
    Heading,
    Paragraph,
} from "../types/block"
import { uuid } from "../utils"

function parseBlock(text: string): Block {
    const document: Document = {
        id: uuid(),
        type: "document",
        children: [],
        startIndex: 0,
        endIndex: 0,
    }

    const documentBlock: BlockContext = {
        type: "document",
        node: document,
        parent: null,
        startIndex: 0,
        rawText: "",
        canContinue: () => true,
        addLine: () => {},
        finalize: () => {},
    }

    const openBlocks: BlockContext[] = [documentBlock]
    const linkReferences = new Map<string, LinkReference>()

    const lines = text.split("\n")
    let currentPos = 0

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const rawLine = lines[lineIndex]
        const lineStartPos = currentPos
        const line = new LineState(rawLine)

        const lineEndPos = lineStartPos + rawLine.length + (lineIndex < lines.length - 1 ? 1 : 0)

        const isAtDocumentLevel =
            openBlocks.length === 1 && openBlocks[0].type === "document"
        if (isAtDocumentLevel) {
            const definition = parseLinkReferenceDefinition(line.remaining())
            if (definition) {
                linkReferences.set(definition.label, {
                    url: definition.url,
                    title: definition.title,
                })
                currentPos = lineEndPos
                continue
            }
        }

        let closedCodeBlock = false
        if (openBlocks.length > 0) {
            const lastBlock = openBlocks[openBlocks.length - 1]
            if (
                lastBlock.type === "paragraph" &&
                lastBlock.node.type === "paragraph"
            ) {
                const setextMatch = line
                    .remaining()
                    .trim()
                    .match(/^(=+|-+)\s*$/)
                if (setextMatch && setextMatch[1].length >= 3) {
                    const level = setextMatch[1][0] === "=" ? 1 : 2
                    const para = lastBlock.node as Paragraph

                    lastBlock.finalize(lineEndPos)

                    const heading: Heading = {
                        id: uuid(),
                        type: "heading",
                        level,
                        children: para.children || [],
                        rawText: para.rawText + "\n" + rawLine,
                        pureText: para.rawText.trim(),
                        synthText: para.rawText.trim(),
                        startIndex: para.startIndex,
                        endIndex: lineEndPos,
                    }

                    openBlocks.pop()
                    const parent = openBlocks[openBlocks.length - 1]
                    if (parent && isContainerBlock(parent.node)) {
                        const paraIndex = parent.node.children.indexOf(para)
                        if (paraIndex !== -1) {
                            parent.node.children.splice(paraIndex, 1)
                        }
                        parent.node.children.push(heading)
                    }
                    currentPos = lineEndPos
                    continue
                }
            }
        }

        for (let i = 0; i < openBlocks.length; i++) {
            const block = openBlocks[i]
            const checkLine = new LineState(rawLine)
            if (!block.canContinue(checkLine)) {
                if (block.type === "codeBlock") {
                    const remaining = checkLine.remaining().trim()
                    if (remaining.match(/^[`~]{3,}\s*$/)) {
                        closedCodeBlock = true
                    }
                }
                while (openBlocks.length > i) {
                    const blockToClose = openBlocks.pop()!
                    closeBlock(blockToClose, lineEndPos)
                }
                break
            }
        }

        // after refactor improve loop safeguard
        let loopCounter = 0
        while (true) {
            if (++loopCounter > 100) {
                console.error("1. Potential infinite loop detected", JSON.stringify(openBlocks, null, 2))
                break
            }

            const parent = openBlocks[openBlocks.length - 1]

            if (parent.type === "list") {
                const newItem = tryOpenListItem(line, parent, lineStartPos)
                if (newItem) {
                    openBlocks.push(newItem)
                }
                break
            }

            if (parent.type === "listItem") {
                const newList = tryOpenList(line, parent, lineStartPos)
                if (newList) {
                    openBlocks.push(newList)
                    continue
                }
            }

            const newBlock = tryOpenBlock(line, parent, lineStartPos)
            if (!newBlock) break
            openBlocks.push(newBlock)
        }

        if (!closedCodeBlock) {
            const deepestBlock = openBlocks[openBlocks.length - 1]
            deepestBlock.addLine(line.remaining(), rawLine)
        }

        currentPos = lineEndPos
    }

    // after refactor improve loop safeguard
    let loopLimit = 0
    while (openBlocks.length > 1 && loopLimit > 0) {
        if (++loopLimit > 100) {
            console.error("2. Potential infinite loop detected", JSON.stringify(openBlocks, null, 2))
            break
        }
        const blockToClose = openBlocks.pop()!
        closeBlock(blockToClose, currentPos)
    }

    ;(document as Document & { __linkReferences?: Map<string, LinkReference> }).__linkReferences = linkReferences

    return document
}

export { parseBlock }
