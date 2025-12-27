import { parseLinkDestinationAndTitle } from "./inline/links"
import { processEmphasis } from "./inline/emphasis"
import { decodeHTMLEntity } from "../utils/htmlEntities"
import type { LinkReference, Delimiter } from "../types"
import type { Inline } from "../types/inline"
import { uuid } from "../utils"

function parseInline(
    text: string,
    linkReferences?: Map<string, LinkReference>,
    startOffset: number = 0,
): Inline[] {
    const result: Inline[] = []
    const delimiterStack: Delimiter[] = []
    let pos = 0
    let textStart = 0

    const addText = (start: number, end: number) => {
        if (end > start) {
            const textContent = text.slice(start, end)
            if (textContent.length > 0) {
                const rawText = textContent
                const startIndex = startOffset + start
                const endIndex = startOffset + end
                result.push({
                    id: uuid(),
                    type: "Text",
                    value: decodeHTMLEntity(textContent),
                    rawText,
                    pureText: textContent,
                    synthText: textContent,
                    startIndex,
                    endIndex,
                })
            }
        }
    }

    /**
     * A left-flanking delimiter run is a delimiter run that is:
     * (1) not followed by a Unicode whitespace character, and
     * (2a) not followed by a Unicode punctuation character, or
     * (2b) followed by a Unicode punctuation character and
     *      preceded by a Unicode whitespace character or a Unicode punctuation character.
     */
    const isLeftFlanking = (pos: number, runLength: number): boolean => {
        const afterRun = pos + runLength
        if (afterRun >= text.length) return false
        const charAfter = text[afterRun]
        const charBefore = pos > 0 ? text[pos - 1] : " "

        // Not followed by whitespace
        if (/\s/.test(charAfter)) return false
        
        // Not followed by punctuation, OR preceded by whitespace/punctuation
        if (/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/.test(charAfter)) {
            return /\s/.test(charBefore) || /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/.test(charBefore)
        }
        return true
    }

    /**
     * A right-flanking delimiter run is a delimiter run that is:
     * (1) not preceded by a Unicode whitespace character, and
     * (2a) not preceded by a Unicode punctuation character, or
     * (2b) preceded by a Unicode punctuation character and
     *      followed by a Unicode whitespace character or a Unicode punctuation character.
     */
    const isRightFlanking = (pos: number, runLength: number): boolean => {
        if (pos === 0) return false
        const charBefore = text[pos - 1]
        const charAfter = pos + runLength < text.length ? text[pos + runLength] : " "

        // Not preceded by whitespace
        if (/\s/.test(charBefore)) return false
        
        // Not preceded by punctuation, OR followed by whitespace/punctuation
        if (/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/.test(charBefore)) {
            return /\s/.test(charAfter) || /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/.test(charAfter)
        }
        return true
    }

    while (pos < text.length) {
        // Backslash escapes
        // Any ASCII punctuation character may be backslash-escaped
        if (text[pos] === "\\" && pos + 1 < text.length) {
            const escaped = text[pos + 1]
            if (/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/.test(escaped)) {
                addText(textStart, pos)
                const rawText = text.slice(pos, pos + 2)
                const startIndex = startOffset + pos
                const endIndex = startOffset + pos + 2
                result.push({ 
                    id: uuid(),
                    type: "Text", 
                    value: escaped,
                    rawText,
                    pureText: escaped,
                    synthText: rawText,
                    startIndex,
                    endIndex,
                })
                pos += 2
                textStart = pos
                continue
            }
            // Hard line break: backslash at end of line
            if (escaped === "\n") {
                addText(textStart, pos)
                result.push({
                    id: uuid(),
                    type: "HardBreak",
                    rawText: "\\\n",
                    startIndex: startOffset + pos,
                    endIndex: startOffset + pos + 2,
                })
                pos += 2
                textStart = pos
                continue
            }
        }

        // Entity references
        if (text[pos] === "&") {
            const entityMatch = text.slice(pos).match(/^&(?:#[xX]([0-9a-fA-F]{1,6});|#(\d{1,7});|([a-zA-Z][a-zA-Z0-9]{1,31});)/)
            if (entityMatch) {
                addText(textStart, pos)
                const entityRaw = entityMatch[0]
                const decoded = decodeHTMLEntity(entityRaw)
                result.push({
                    id: uuid(),
                    type: "Entity",
                    decoded,
                    rawText: entityRaw,
                    startIndex: startOffset + pos,
                    endIndex: startOffset + pos + entityRaw.length,
                })
                pos += entityRaw.length
                textStart = pos
                continue
            }
        }

        // Code spans
        // Backtick strings of any length can be used
        if (text[pos] === "`") {
            addText(textStart, pos)
            let backtickCount = 1
            while (pos + backtickCount < text.length && text[pos + backtickCount] === "`") {
                backtickCount++
            }

            let searchPos = pos + backtickCount
            let found = false
            while (searchPos < text.length) {
                if (text[searchPos] === "`") {
                    let closeCount = 1
                    while (searchPos + closeCount < text.length && text[searchPos + closeCount] === "`") {
                        closeCount++
                    }
                    if (closeCount === backtickCount) {
                        // Extract and normalize code content
                        let codeContent = text.slice(pos + backtickCount, searchPos)
                        // Line endings are converted to spaces
                        codeContent = codeContent.replace(/\n/g, " ")
                        // If string begins AND ends with space and has non-space content,
                        // strip one leading and trailing space
                        if (codeContent.length > 0 && 
                            codeContent[0] === " " && 
                            codeContent[codeContent.length - 1] === " " && 
                            codeContent.trim().length > 0) {
                            codeContent = codeContent.slice(1, -1)
                        }
                        
                        const rawText = text.slice(pos, searchPos + backtickCount)
                        result.push({ 
                            id: uuid(),
                            type: "CodeSpan", 
                            value: codeContent,
                            rawText,
                            startIndex: startOffset + pos,
                            endIndex: startOffset + searchPos + backtickCount,
                        })
                        pos = searchPos + backtickCount
                        textStart = pos
                        found = true
                        break
                    }
                    searchPos += closeCount
                } else {
                    searchPos++
                }
            }
            if (found) continue
            
            // No matching backticks - treat as text and continue
            pos += backtickCount
            continue
        }

        // Autolinks
        if (text[pos] === "<") {
            let matched = false
            
            // URI autolinks
            const uriMatch = text.slice(pos).match(/^<([a-zA-Z][a-zA-Z0-9+.-]{1,31}:[^\s<>]*)>/)
            if (uriMatch) {
                addText(textStart, pos)
                result.push({ 
                    id: uuid(),
                    type: "Autolink", 
                    url: uriMatch[1],
                    rawText: uriMatch[0],
                    startIndex: startOffset + pos,
                    endIndex: startOffset + pos + uriMatch[0].length,
                })
                pos += uriMatch[0].length
                textStart = pos
                matched = true
            }
            
            // Email autolinks
            if (!matched) {
                const emailMatch = text.slice(pos).match(/^<([a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*)>/)
                if (emailMatch) {
                    addText(textStart, pos)
                    result.push({ 
                        id: uuid(),
                        type: "Autolink", 
                        url: "mailto:" + emailMatch[1],
                        rawText: emailMatch[0],
                        startIndex: startOffset + pos,
                        endIndex: startOffset + pos + emailMatch[0].length,
                    })
                    pos += emailMatch[0].length
                    textStart = pos
                    matched = true
                }
            }
            
            // Raw HTML
            if (!matched) {
                const htmlMatch = text.slice(pos).match(/^<(\/?[a-zA-Z][a-zA-Z0-9]*\b[^>]*>|!--[\s\S]*?-->|!\[CDATA\[[\s\S]*?\]\]>|\?[^>]*\?>|![A-Z]+[^>]*>)/)
                if (htmlMatch) {
                    addText(textStart, pos)
                    result.push({ 
                        id: uuid(),
                        type: "HTML", 
                        html: htmlMatch[0],
                        rawText: htmlMatch[0],
                        startIndex: startOffset + pos,
                        endIndex: startOffset + pos + htmlMatch[0].length,
                    })
                    pos += htmlMatch[0].length
                    textStart = pos
                    matched = true
                }
            }
            
            if (matched) continue
            pos++
            continue
        }

        // Images
        if (text[pos] === "!" && pos + 1 < text.length && text[pos + 1] === "[") {
            const imageResult = parseImage(text, pos, linkReferences, startOffset)
            if (imageResult) {
                addText(textStart, pos)
                result.push(imageResult.node)
                pos = imageResult.endPos
                textStart = pos
                continue
            }
        }

        // Links
        if (text[pos] === "[") {
            const linkResult = parseLink(text, pos, linkReferences, startOffset)
            if (linkResult) {
                addText(textStart, pos)
                result.push(linkResult.node)
                pos = linkResult.endPos
                textStart = pos
                continue
            }
        }

        // Strikethrough
        if (text[pos] === "~" && pos + 1 < text.length && text[pos + 1] === "~") {
            const closePos = text.indexOf("~~", pos + 2)
            if (closePos !== -1) {
                addText(textStart, pos)
                const innerText = text.slice(pos + 2, closePos)
                const innerNodes = parseInline(innerText, linkReferences, startOffset + pos + 2)
                result.push({
                    id: uuid(),
                    type: "Strikethrough",
                    children: innerNodes,
                    rawText: text.slice(pos, closePos + 2),
                    startIndex: startOffset + pos,
                    endIndex: startOffset + closePos + 2,
                })
                pos = closePos + 2
                textStart = pos
                continue
            }
        }

        // Emphasis and strong emphasis
        if (text[pos] === "*" || text[pos] === "_") {
            const delimType = text[pos] as "*" | "_"
            let runLength = 1
            while (pos + runLength < text.length && text[pos + runLength] === delimType) {
                runLength++
            }

            const leftFlanking = isLeftFlanking(pos, runLength)
            const rightFlanking = isRightFlanking(pos, runLength)

            // Determine if can open/close based on flanking rules
            let canOpen = leftFlanking
            let canClose = rightFlanking

            // For _, additional rules apply (intraword emphasis)
            if (delimType === "_") {
                const charBefore = pos > 0 ? text[pos - 1] : " "
                const charAfter = pos + runLength < text.length ? text[pos + runLength] : " "
                canOpen = leftFlanking && (!rightFlanking || /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/.test(charBefore))
                canClose = rightFlanking && (!leftFlanking || /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/.test(charAfter))
            }

            if (canOpen || canClose) {
                addText(textStart, pos)
                const rawText = delimType.repeat(runLength)
                const startIndex = startOffset + pos
                const endIndex = startOffset + pos + runLength
                const textNode: Inline = {
                    id: uuid(),
                    type: "Text",
                    value: rawText,
                    rawText,
                    pureText: rawText,
                    synthText: rawText,
                    startIndex,
                    endIndex,
                }
                result.push(textNode)

                delimiterStack.push({
                    type: delimType,
                    length: runLength,
                    pos: result.length - 1,
                    canOpen,
                    canClose,
                    node: textNode,
                })

                textStart = pos + runLength
            }

            pos += runLength
            continue
        }

        // Hard line break: two+ spaces followed by newline
        if (text[pos] === " ") {
            let spaceCount = 1
            while (pos + spaceCount < text.length && text[pos + spaceCount] === " ") {
                spaceCount++
            }
            if (spaceCount >= 2 && pos + spaceCount < text.length && text[pos + spaceCount] === "\n") {
                addText(textStart, pos)
                result.push({
                    id: uuid(),
                    type: "HardBreak",
                    rawText: " ".repeat(spaceCount) + "\n",
                    startIndex: startOffset + pos,
                    endIndex: startOffset + pos + spaceCount + 1,
                })
                pos += spaceCount + 1
                textStart = pos
                continue
            }
        }

        // Soft line break
        if (text[pos] === "\n") {
            addText(textStart, pos)
            result.push({
                id: uuid(),
                type: "SoftBreak",
                rawText: "\n",
                startIndex: startOffset + pos,
                endIndex: startOffset + pos + 1,
            })
            pos++
            textStart = pos
            continue
        }

        pos++
    }

    addText(textStart, pos)

    // Process emphasis
    processEmphasis(delimiterStack, result)

    return result
}

/**
 * Parse a link construct [text](url "title") or [text][ref]
 */
function parseLink(
    text: string,
    start: number,
    linkReferences?: Map<string, LinkReference>,
    startOffset: number = 0
): { node: Inline; endPos: number } | null {
    // Find matching ]
    let bracketDepth = 1
    let pos = start + 1
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

    const linkTextEnd = pos - 1
    const linkText = text.slice(start + 1, linkTextEnd)

    // Inline link: [text](url "title")
    if (pos < text.length && text[pos] === "(") {
        const linkInfo = parseLinkDestinationAndTitle(text, pos)
        if (linkInfo) {
            const linkStartIndex = startOffset + start + 1
            const linkChildren =
                linkText.trim() === ""
                    ? [
                          {
                              id: uuid(),
                              type: "Text" as const,
                              value: linkInfo.url,
                              rawText: linkInfo.url,
                              pureText: linkInfo.url,
                              synthText: linkInfo.url,
                              startIndex: linkStartIndex,
                              endIndex: linkStartIndex + linkInfo.url.length,
                          },
                      ]
                    : parseInline(linkText, linkReferences, linkStartIndex)
            return {
                node: {
                    id: uuid(),
                    type: "Link",
                    url: linkInfo.url,
                    title: linkInfo.title,
                    children: linkChildren,
                    rawText: text.slice(start, linkInfo.end),
                    startIndex: startOffset + start,
                    endIndex: startOffset + linkInfo.end,
                },
                endPos: linkInfo.end,
            }
        }
    }

    // Reference link: [text][ref] or [text][] or [text]
    if (linkReferences) {
        let refLabel = ""
        let refEnd = pos

        if (pos < text.length && text[pos] === "[") {
            const refEndPos = text.indexOf("]", pos + 1)
            if (refEndPos !== -1) {
                refLabel = text.slice(pos + 1, refEndPos).toLowerCase().trim()
                if (refLabel === "") {
                    refLabel = linkText.toLowerCase().trim()
                }
                refEnd = refEndPos + 1
            } else {
                return null
            }
        } else {
            refLabel = linkText.toLowerCase().trim()
        }

        const ref = linkReferences.get(refLabel)
        if (ref) {
            const linkStartIndex = startOffset + start + 1
            const linkChildren =
                linkText.trim() === ""
                    ? [{
                        id: uuid(),
                        type: "Text" as const,
                        value: ref.url,
                        rawText: ref.url,
                        pureText: ref.url,
                        synthText: ref.url,
                        startIndex: linkStartIndex,
                        endIndex: linkStartIndex + ref.url.length,
                    }]
                    : parseInline(linkText, linkReferences, linkStartIndex)
            return {
                node: {
                    id: uuid(),
                    type: "Link",
                    url: ref.url,
                    title: ref.title,
                    children: linkChildren,
                    rawText: text.slice(start, refEnd),
                    startIndex: startOffset + start,
                    endIndex: startOffset + refEnd,
                },
                endPos: refEnd,
            }
        }
    }

    return null
}

/**
 * Parse an image construct ![alt](url "title") or ![alt][ref]
 */
function parseImage(
    text: string,
    start: number,
    linkReferences?: Map<string, LinkReference>,
    startOffset: number = 0
): { node: Inline; endPos: number } | null {
    if (text[start + 1] !== "[") return null

    // Find matching ]
    let bracketDepth = 1
    let pos = start + 2
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
    const altText = text.slice(start + 2, altTextEnd)

    // Inline image: ![alt](url "title")
    if (pos < text.length && text[pos] === "(") {
        const linkInfo = parseLinkDestinationAndTitle(text, pos)
        if (linkInfo) {
            return {
                node: {
                    id: uuid(),
                    type: "Image",
                    url: linkInfo.url,
                    alt: altText,
                    title: linkInfo.title,
                    rawText: text.slice(start, linkInfo.end),
                    startIndex: startOffset + start,
                    endIndex: startOffset + linkInfo.end,
                },
                endPos: linkInfo.end,
            }
        }
    }

    // Reference image: ![alt][ref] or ![alt][] or ![alt]
    if (linkReferences) {
        let refLabel = ""
        let refEnd = pos

        if (pos < text.length && text[pos] === "[") {
            const refEndPos = text.indexOf("]", pos + 1)
            if (refEndPos !== -1) {
                refLabel = text.slice(pos + 1, refEndPos).toLowerCase().trim()
                refEnd = refEndPos + 1
            } else {
                return null
            }
        }

        if (refLabel === "") {
            refLabel = altText.toLowerCase().trim()
        }

        const ref = linkReferences.get(refLabel)
        if (ref) {
            return {
                node: {
                    id: uuid(),
                    type: "Image",
                    url: ref.url,
                    alt: altText,
                    title: ref.title,
                    rawText: text.slice(start, refEnd),
                    startIndex: startOffset + start,
                    endIndex: startOffset + refEnd,
                },
                endPos: refEnd,
            }
        }
    }

    return null
}

function parseInlineWithBreaks(
    lines: Array<{ text: string; hardBreak: boolean; originalLine: string; lineStartIndex: number }>,
    linkReferences?: Map<string, LinkReference>,
): Inline[] {
    const result: Inline[] = []
    let currentOffset = 0

    for (let i = 0; i < lines.length; i++) {
        const { text, hardBreak, originalLine, lineStartIndex } = lines[i]
        if (text.length > 0) {
            const inlineStart = lineStartIndex + (originalLine.length - text.length)
            const inlines = parseInline(text, linkReferences, inlineStart)
            result.push(...inlines)
            currentOffset = inlineStart + text.length
        }

        if (i < lines.length - 1) {
            const breakStart = currentOffset
            const breakEnd = breakStart + (hardBreak ? 2 : 1)
            result.push({ 
                id: uuid(),
                type: hardBreak ? "HardBreak" : "SoftBreak",
                rawText: hardBreak ? "  " : " ",
                startIndex: breakStart,
                endIndex: breakEnd,
            })
        }
    }

    return result
}

export { parseInline, parseInlineWithBreaks }
