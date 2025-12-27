import { uuid } from "../../utils"
import { parseLinkDestinationAndTitle } from "./links"
import type { Image } from "../../types/inline"
import type { LinkReference } from "../../types"

/**
 * Syntax: ![alt text](url "optional title")
 * Or reference: ![alt text][ref]
 * 
 * Images are like links except:
 * - They begin with ! followed by [
 * - They produce img elements instead of links
 * - The link text becomes the alt attribute
 */

/**
 * Parse an inline image at the given position
 * @param text - Text to parse (should start with !)
 * @param linkReferences - Optional map of link reference definitions
 * @param startOffset - Offset in original document
 */
function parseImage(
    text: string,
    linkReferences?: Map<string, LinkReference>,
    startOffset: number = 0
): { node: Image; endPos: number } | null {
    // Must start with ![
    if (text.length < 4 || text[0] !== "!" || text[1] !== "[") return null

    // Find matching ]
    let bracketDepth = 1
    let pos = 2
    while (pos < text.length && bracketDepth > 0) {
        if (text[pos] === "\\") {
            pos += 2
            continue
        }
        if (text[pos] === "[") bracketDepth++
        if (text[pos] === "]") bracketDepth--
        pos++
    }

    if (bracketDepth !== 0) return null

    const altTextEnd = pos - 1
    const altText = text.slice(2, altTextEnd)

    // Try inline image: ![alt](url "title")
    if (pos < text.length && text[pos] === "(") {
        const linkInfo = parseLinkDestinationAndTitle(text, pos)
        if (linkInfo) {
            const rawText = text.slice(0, linkInfo.end)
            return {
                node: {
                    id: uuid(),
                    type: "Image",
                    url: linkInfo.url,
                    alt: altText,
                    title: linkInfo.title,
                    rawText,
                    startIndex: startOffset,
                    endIndex: startOffset + linkInfo.end,
                },
                endPos: linkInfo.end,
            }
        }
    }

    // Try reference image: ![alt][ref] or ![alt][] or ![alt]
    if (linkReferences) {
        let refLabel = ""
        let refEnd = pos

        // Full reference: ![alt][ref]
        if (pos < text.length && text[pos] === "[") {
            const refClosePos = text.indexOf("]", pos + 1)
            if (refClosePos !== -1) {
                refLabel = text.slice(pos + 1, refClosePos).toLowerCase().trim()
                refEnd = refClosePos + 1
            }
        }

        // Collapsed reference ![alt][] or shortcut reference ![alt]
        if (refLabel === "") {
            refLabel = altText.toLowerCase().trim()
        }

        const ref = linkReferences.get(refLabel)
        if (ref) {
            const rawText = text.slice(0, refEnd)
            return {
                node: {
                    id: uuid(),
                    type: "Image",
                    url: ref.url,
                    alt: altText,
                    title: ref.title,
                    rawText,
                    startIndex: startOffset,
                    endIndex: startOffset + refEnd,
                },
                endPos: refEnd,
            }
        }
    }

    return null
}

/**
 * Check if text starts with an image
 */
function isImage(text: string): boolean {
    return text.length >= 2 && text[0] === "!" && text[1] === "["
}

export { parseImage, isImage }
