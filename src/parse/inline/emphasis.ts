import type { Delimiter } from "../../types"
import type { Inline, Text } from "../../types/inline"
import { uuid } from "../../utils"

function processEmphasis(stack: Delimiter[], nodes: Inline[]) {
    if (stack.length === 0) return

    // Track openers_bottom for each delimiter type and length mod 3
    // The extra key is for whether the closer can also be opener
    const openersBottom: Record<string, Record<string, number>> = {
        "*": { "0_opener": -1, "1_opener": -1, "2_opener": -1, "0_both": -1, "1_both": -1, "2_both": -1 },
        "_": { "0_opener": -1, "1_opener": -1, "2_opener": -1, "0_both": -1, "1_both": -1, "2_both": -1 },
    }

    let current = 0

    while (current < stack.length) {
        const closer = stack[current]
        
        // Skip if not a closer
        if (!closer.canClose) {
            current++
            continue
        }

        // Determine the bottom key for this closer
        const closerCanBeOpener = closer.canOpen
        const bottomKey = `${closer.length % 3}_${closerCanBeOpener ? "both" : "opener"}`
        const bottom = openersBottom[closer.type]?.[bottomKey] ?? -1

        // Look for an opener
        let openerIndex = -1

        for (let i = current - 1; i > bottom; i--) {
            const opener = stack[i]
            
            // Must be same type and be an opener
            if (opener.type !== closer.type || !opener.canOpen) {
                continue
            }

            // Rule: If one of the delimiters can both open and close emphasis,
            // then the sum of the two lengths must not be a multiple of 3
            // unless both lengths are multiples of 3
            if ((opener.canOpen && opener.canClose) || (closer.canOpen && closer.canClose)) {
                if ((opener.length + closer.length) % 3 === 0) {
                    if (opener.length % 3 !== 0 || closer.length % 3 !== 0) {
                        continue
                    }
                }
            }

            openerIndex = i
            break
        }

        if (openerIndex === -1) {
            // No opener found - update bottom and continue
            if (!closer.canOpen) {
                // Remove closer from consideration for future
                stack.splice(current, 1)
            } else {
                openersBottom[closer.type][bottomKey] = current - 1
                current++
            }
            continue
        }

        const opener = stack[openerIndex]
        
        // Determine if this is strong (2 chars) or regular emphasis (1 char)
        // Strong requires at least 2 chars in both opener and closer
        const useLength = Math.min(2, Math.min(opener.length, closer.length))
        const isStrong = useLength >= 2

        // Collect children between opener and closer
        const startIdx = opener.pos + 1
        const endIdx = closer.pos
        const children = nodes.slice(startIdx, endIdx)

        // Get the opener and closer nodes
        const openerNode = nodes[opener.pos]
        const closerNode = nodes[closer.pos]
        
        // Build raw text for the emphasis node
        const delimChar = opener.type
        const delimStr = delimChar.repeat(useLength)
        
        let rawText = delimStr
        for (const child of children) {
            rawText += child.rawText
        }
        rawText += delimStr

        // Compute positions
        const startIndex = openerNode ? openerNode.startIndex : (children[0]?.startIndex ?? 0)
        const endIndex = closerNode ? (closerNode.startIndex + useLength) : (children[children.length - 1]?.endIndex ?? 0)

        // Create the emphasis node
        const emphasisNode: Inline = isStrong
            ? { 
                id: uuid(), 
                type: "Strong", 
                children, 
                rawText, 
                startIndex, 
                endIndex,
                delimiter: (delimChar + delimChar) as "**" | "__",
            }
            : { 
                id: uuid(), 
                type: "Emphasis", 
                children, 
                rawText, 
                startIndex, 
                endIndex,
                delimiter: delimChar as "*" | "_",
            }

        // Update opener
        opener.length -= useLength
        let openerRemoved = false

        if (openerNode && openerNode.type === "Text") {
            const openerText = openerNode as Text
            if (opener.length > 0) {
                openerText.value = delimChar.repeat(opener.length)
                openerText.rawText = delimChar.repeat(opener.length)
                openerText.pureText = delimChar.repeat(opener.length)
                openerText.synthText = delimChar.repeat(opener.length)
                openerText.endIndex = openerText.startIndex + opener.length
            } else {
                nodes.splice(opener.pos, 1)
                openerRemoved = true
                // Update positions in stack
                for (let j = 0; j < stack.length; j++) {
                    if (stack[j].pos > opener.pos) stack[j].pos--
                }
                if (closer.pos > opener.pos) closer.pos--
            }
        }

        // Update closer
        closer.length -= useLength

        if (closerNode && closerNode.type === "Text") {
            const closerText = closerNode as Text
            if (closer.length > 0) {
                closerText.value = delimChar.repeat(closer.length)
                closerText.rawText = delimChar.repeat(closer.length)
                closerText.pureText = delimChar.repeat(closer.length)
                closerText.synthText = delimChar.repeat(closer.length)
                closerText.startIndex = closerText.endIndex - closer.length
            } else {
                nodes.splice(closer.pos, 1)
                // Update positions in stack
                for (let j = 0; j < stack.length; j++) {
                    if (stack[j].pos > closer.pos) stack[j].pos--
                }
            }
        }

        // Insert emphasis node in place of children
        let insertPos = opener.pos
        if (!openerRemoved) {
            insertPos = opener.pos + 1
        }

        const childrenCount = children.length
        nodes.splice(insertPos, childrenCount, emphasisNode)

        // Update positions for remaining stack entries
        const netChange = 1 - childrenCount
        for (let j = 0; j < stack.length; j++) {
            if (stack[j].pos >= insertPos + childrenCount) {
                stack[j].pos += netChange
            }
        }

        // Remove all delimiters between opener and closer (inclusive if empty)
        stack.splice(openerIndex + 1, current - openerIndex)

        // If opener is empty, remove it too
        if (opener.length === 0) {
            stack.splice(openerIndex, 1)
        }

        // Restart from the beginning to handle nested emphasis correctly
        current = 0
    }
}

export { processEmphasis }
