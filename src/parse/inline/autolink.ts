import { uuid } from "../../utils"
import type { Autolink } from "../../types/inline"

/**
 * Autolinks are absolute URIs and email addresses inside < and >.
 * They are parsed as links with the URL or mailto: email as destination.
 */

/**
 * URI autolink pattern
 * An absolute URI is a scheme (1-32 alphanumeric chars) followed by : followed by
 * any non-whitespace non-< non-> characters
 */
const URI_AUTOLINK_REGEX = /^<([a-zA-Z][a-zA-Z0-9+.-]{0,31}:[^\s<>]*)>/

/**
 * Email autolink pattern
 * A valid email address pattern according to CommonMark
 */
const EMAIL_AUTOLINK_REGEX = /^<([a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*)>/

/**
 * Parse a URI autolink at the given position
 */
function parseURIAutolink(
    text: string,
    startOffset: number = 0
): { node: Autolink; endPos: number } | null {
    const match = text.match(URI_AUTOLINK_REGEX)
    if (!match) return null

    const url = match[1]
    const rawText = match[0]

    return {
        node: {
            id: uuid(),
            type: "Autolink",
            url,
            rawText,
            startIndex: startOffset,
            endIndex: startOffset + rawText.length,
        },
        endPos: rawText.length,
    }
}

/**
 * Parse an email autolink at the given position
 */
function parseEmailAutolink(
    text: string,
    startOffset: number = 0
): { node: Autolink; endPos: number } | null {
    const match = text.match(EMAIL_AUTOLINK_REGEX)
    if (!match) return null

    const email = match[1]
    const rawText = match[0]

    return {
        node: {
            id: uuid(),
            type: "Autolink",
            url: `mailto:${email}`,
            rawText,
            startIndex: startOffset,
            endIndex: startOffset + rawText.length,
        },
        endPos: rawText.length,
    }
}

/**
 * Try to parse any type of autolink at the given position
 */
function parseAutolink(
    text: string,
    startOffset: number = 0
): { node: Autolink; endPos: number } | null {
    // Try URI autolink first
    const uriResult = parseURIAutolink(text, startOffset)
    if (uriResult) return uriResult

    // Try email autolink
    const emailResult = parseEmailAutolink(text, startOffset)
    if (emailResult) return emailResult

    return null
}

/**
 * Check if a string starts with an autolink
 */
function isAutolink(text: string): boolean {
    return URI_AUTOLINK_REGEX.test(text) || EMAIL_AUTOLINK_REGEX.test(text)
}

export { 
    parseAutolink, 
    parseURIAutolink, 
    parseEmailAutolink, 
    isAutolink,
    URI_AUTOLINK_REGEX,
    EMAIL_AUTOLINK_REGEX,
}
