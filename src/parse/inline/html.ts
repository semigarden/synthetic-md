import { uuid } from "../../utils"
import type { HTML } from "../../types/inline"

/**
 * Inline raw HTML is one of:
 * - An open tag: <tagname attributes>
 * - A closing tag: </tagname>
 * - An HTML comment: <!-- ... -->
 * - A processing instruction: <? ... ?>
 * - A declaration: <!NAME ...>
 * - A CDATA section: <![CDATA[ ... ]]>
 */

// Open tag pattern: <tagname attributes>
const OPEN_TAG_REGEX = /^<([a-zA-Z][a-zA-Z0-9-]*)(?:\s+[a-zA-Z_:][a-zA-Z0-9_.:-]*(?:\s*=\s*(?:[^\s"'=<>`]+|'[^']*'|"[^"]*"))?)*\s*\/?>/

// Closing tag pattern: </tagname>
const CLOSE_TAG_REGEX = /^<\/([a-zA-Z][a-zA-Z0-9-]*)\s*>/

// HTML comment: <!-- ... -->
const COMMENT_REGEX = /^<!--[\s\S]*?-->/

// Processing instruction: <? ... ?>
const PROCESSING_REGEX = /^<\?[\s\S]*?\?>/

// Declaration: <!NAME ...>
const DECLARATION_REGEX = /^<![A-Z]+[^>]*>/

// CDATA section: <![CDATA[ ... ]]>
const CDATA_REGEX = /^<!\[CDATA\[[\s\S]*?\]\]>/

/**
 * List of valid HTML tag names for inline HTML
 * Includes both inline and block-level elements that can appear inline
 */
const INLINE_HTML_TAGS = new Set([
    // Inline elements
    "a", "abbr", "acronym", "b", "bdi", "bdo", "big", "br", "button",
    "cite", "code", "data", "datalist", "del", "dfn", "em", "i", "img",
    "input", "ins", "kbd", "label", "map", "mark", "meter", "noscript",
    "object", "output", "picture", "progress", "q", "ruby", "s", "samp",
    "script", "select", "slot", "small", "span", "strong", "sub", "sup",
    "svg", "template", "textarea", "time", "tt", "u", "var", "video", "wbr",
])

/**
 * Parse raw HTML at the given position
 */
function parseRawHTML(
    text: string,
    startOffset: number = 0
): { node: HTML; endPos: number } | null {
    if (text.length === 0 || text[0] !== "<") return null

    let match: RegExpMatchArray | null = null
    let rawText: string

    // Try each pattern in order of specificity

    // HTML comment
    match = text.match(COMMENT_REGEX)
    if (match) {
        rawText = match[0]
        return {
            node: {
                id: uuid(),
                type: "HTML",
                html: rawText,
                rawText,
                startIndex: startOffset,
                endIndex: startOffset + rawText.length,
            },
            endPos: rawText.length,
        }
    }

    // CDATA section
    match = text.match(CDATA_REGEX)
    if (match) {
        rawText = match[0]
        return {
            node: {
                id: uuid(),
                type: "HTML",
                html: rawText,
                rawText,
                startIndex: startOffset,
                endIndex: startOffset + rawText.length,
            },
            endPos: rawText.length,
        }
    }

    // Processing instruction
    match = text.match(PROCESSING_REGEX)
    if (match) {
        rawText = match[0]
        return {
            node: {
                id: uuid(),
                type: "HTML",
                html: rawText,
                rawText,
                startIndex: startOffset,
                endIndex: startOffset + rawText.length,
            },
            endPos: rawText.length,
        }
    }

    // Declaration
    match = text.match(DECLARATION_REGEX)
    if (match) {
        rawText = match[0]
        return {
            node: {
                id: uuid(),
                type: "HTML",
                html: rawText,
                rawText,
                startIndex: startOffset,
                endIndex: startOffset + rawText.length,
            },
            endPos: rawText.length,
        }
    }

    // Closing tag
    match = text.match(CLOSE_TAG_REGEX)
    if (match) {
        rawText = match[0]
        return {
            node: {
                id: uuid(),
                type: "HTML",
                html: rawText,
                rawText,
                startIndex: startOffset,
                endIndex: startOffset + rawText.length,
            },
            endPos: rawText.length,
        }
    }

    // Open tag
    match = text.match(OPEN_TAG_REGEX)
    if (match) {
        rawText = match[0]
        return {
            node: {
                id: uuid(),
                type: "HTML",
                html: rawText,
                rawText,
                startIndex: startOffset,
                endIndex: startOffset + rawText.length,
            },
            endPos: rawText.length,
        }
    }

    return null
}

/**
 * Check if text starts with raw HTML
 */
function isRawHTML(text: string): boolean {
    if (text.length === 0 || text[0] !== "<") return false

    return (
        COMMENT_REGEX.test(text) ||
        CDATA_REGEX.test(text) ||
        PROCESSING_REGEX.test(text) ||
        DECLARATION_REGEX.test(text) ||
        CLOSE_TAG_REGEX.test(text) ||
        OPEN_TAG_REGEX.test(text)
    )
}

/**
 * Check if a tag name is a valid inline HTML tag
 */
function isInlineHTMLTag(tagName: string): boolean {
    return INLINE_HTML_TAGS.has(tagName.toLowerCase())
}

export {
    parseRawHTML,
    isRawHTML,
    isInlineHTMLTag,
    OPEN_TAG_REGEX,
    CLOSE_TAG_REGEX,
    COMMENT_REGEX,
    PROCESSING_REGEX,
    DECLARATION_REGEX,
    CDATA_REGEX,
    INLINE_HTML_TAGS,
}
