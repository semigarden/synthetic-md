import { uuid } from "../../utils"
import type { CodeSpan } from "../../types/inline"

/**
 * A backtick string is a string of one or more backtick characters (`)
 * that is neither preceded nor followed by a backtick character.
 * 
 * A code span begins with a backtick string and ends with a backtick
 * string of the same length.
 * 
 * The contents are:
 * - Line endings converted to spaces
 * - If the resulting string begins AND ends with a space character,
 *   but does not consist entirely of space characters, a single space
 *   is removed from front and back.
 */

/**
 * Parse a code span starting at position 0 in the given text
 * @param text - The text to parse (should start with `)
 * @param startOffset - The offset in the original document
 * @returns Parsed code span node and end position, or null if not a valid code span
 */
function parseCodeSpan(
    text: string,
    startOffset: number = 0
): { node: CodeSpan; endPos: number } | null {
    if (text.length === 0 || text[0] !== "`") return null

    // Count opening backticks
    let backtickCount = 0
    while (backtickCount < text.length && text[backtickCount] === "`") {
        backtickCount++
    }

    // Search for matching closing backticks
    let searchPos = backtickCount
    while (searchPos < text.length) {
        if (text[searchPos] === "`") {
            // Count closing backticks
            let closeCount = 0
            while (searchPos + closeCount < text.length && text[searchPos + closeCount] === "`") {
                closeCount++
            }

            if (closeCount === backtickCount) {
                // Found matching close
                const rawContent = text.slice(backtickCount, searchPos)
                const normalizedContent = normalizeCodeSpanContent(rawContent)
                const rawText = text.slice(0, searchPos + backtickCount)

                return {
                    node: {
                        id: uuid(),
                        type: "CodeSpan",
                        value: normalizedContent,
                        rawText,
                        startIndex: startOffset,
                        endIndex: startOffset + rawText.length,
                    },
                    endPos: searchPos + backtickCount,
                }
            }

            // Not a match, skip past these backticks
            searchPos += closeCount
        } else {
            searchPos++
        }
    }

    // No matching closing backticks found
    return null
}

/**
 * Normalize code span content according to CommonMark rules:
 * 1. Line endings are converted to spaces
 * 2. If content starts AND ends with space and contains non-space chars,
 *    strip one leading and trailing space
 */
function normalizeCodeSpanContent(content: string): string {
    // Convert line endings to spaces
    let normalized = content.replace(/\n/g, " ")

    // Strip leading/trailing space if both exist and content has non-space chars
    if (
        normalized.length >= 2 &&
        normalized[0] === " " &&
        normalized[normalized.length - 1] === " " &&
        normalized.trim().length > 0
    ) {
        normalized = normalized.slice(1, -1)
    }

    return normalized
}

/**
 * Check if text starts with a code span
 */
function isCodeSpan(text: string): boolean {
    if (text.length === 0 || text[0] !== "`") return false
    
    // Count backticks
    let count = 0
    while (count < text.length && text[count] === "`") count++
    
    // Look for matching backticks
    const pattern = "`".repeat(count)
    const closePos = text.indexOf(pattern, count)
    
    // Verify it's exactly the same number of backticks
    if (closePos === -1) return false
    
    // Check that closing backticks aren't followed by more backticks
    if (closePos + count < text.length && text[closePos + count] === "`") {
        return false
    }
    
    return true
}

export { parseCodeSpan, normalizeCodeSpanContent, isCodeSpan }
