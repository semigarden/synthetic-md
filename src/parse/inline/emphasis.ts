import type { Delimiter } from "../../types"
import type { Inline, Text } from "../../types/inline"

function processEmphasis(stack: Delimiter[], nodes: Inline[]) {
    let current = 0
    const openersBottom: Record<string, Record<string, number>> = {
        "*": { "0": -1, "1": -1, "2": -1 },
        _: { "0": -1, "1": -1, "2": -1 },
    }

    while (current < stack.length) {
        const closer = stack[current]
        if (!closer.canClose) {
            current++
            continue
        }

        let openerIndex = -1
        const bottom = openersBottom[closer.type][String(closer.length % 3)]

        for (let i = current - 1; i > bottom; i--) {
            const opener = stack[i]
            if (
                opener.type === closer.type &&
                opener.canOpen &&
                opener.length >= 2 === closer.length >= 2
            ) {
                openerIndex = i
                break
            }
        }

        if (openerIndex === -1) {
            if (!closer.canOpen) {
                stack.splice(current, 1)
            } else {
                openersBottom[closer.type][String(closer.length % 3)] =
                    current - 1
                current++
            }
            continue
        }

        const opener = stack[openerIndex]
        const emphasisLength = Math.min(opener.length, closer.length)
        const isStrong = emphasisLength >= 2

        const startIdx = opener.pos + 1
        const endIdx = closer.pos
        const children = nodes.slice(startIdx, endIdx)

        const openerNode = nodes[opener.pos]
        const closerNode = nodes[closer.pos]
        const openerRawText = openerNode && openerNode.type === "Text" 
            ? openerNode.rawText.slice(0, emphasisLength)
            : opener.type.repeat(emphasisLength)
        const closerRawText = closerNode && closerNode.type === "Text"
            ? closerNode.rawText.slice(0, emphasisLength)
            : closer.type.repeat(emphasisLength)
        
        const firstChild = children[0]
        const lastChild = children[children.length - 1]
        const startIndex = openerNode ? openerNode.startIndex : (firstChild ? firstChild.startIndex : 0)
        const endIndex = closerNode ? (closerNode.startIndex + emphasisLength) : (lastChild ? lastChild.endIndex : 0)
        
        let rawText = openerRawText
        for (const child of children) {
            rawText += child.rawText
        }
        rawText += closerRawText

        const emphasisNode: Inline = isStrong
            ? { type: "Strong", children, rawText, startIndex, endIndex }
            : { type: "Emphasis", children, rawText, startIndex, endIndex }

        const openerRemove = emphasisLength
        const closerRemove = emphasisLength

        let openerRemoved = false

        if (openerNode && openerNode.type === "Text") {
            const openerText = openerNode as Text
            const remaining = openerText.value.slice(openerRemove)
            if (remaining.length > 0) {
                openerText.value = remaining
                openerText.rawText = openerText.rawText.slice(openerRemove)
                openerText.startIndex += emphasisLength
            } else {
                nodes.splice(opener.pos, 1)
                openerRemoved = true
                for (let j = 0; j < stack.length; j++) {
                    if (stack[j].pos > opener.pos) stack[j].pos--
                }
                if (closer.pos > opener.pos) closer.pos--
            }
        }

        if (closerNode && closerNode.type === "Text") {
            const closerText = closerNode as Text
            const remaining = closerText.value.slice(closerRemove)
            if (remaining.length > 0) {
                closerText.value = remaining
                closerText.rawText = closerText.rawText.slice(closerRemove)
                closerText.startIndex += emphasisLength
            } else {
                nodes.splice(closer.pos, 1)
                for (let j = 0; j < stack.length; j++) {
                    if (stack[j].pos > closer.pos) stack[j].pos--
                }
            }
        }

        let insertPos = opener.pos
        if (!openerRemoved) {
            insertPos = opener.pos + 1
        }

        const childrenCount = children.length
        nodes.splice(insertPos, childrenCount, emphasisNode)

        const netChange = 1 - childrenCount
        for (let j = 0; j < stack.length; j++) {
            if (stack[j].pos >= insertPos + childrenCount) {
                stack[j].pos += netChange
            }
        }

        stack.splice(openerIndex, current - openerIndex + 1)

        current = 0
    }
}

export { processEmphasis }
