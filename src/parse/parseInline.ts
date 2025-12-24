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

    const canBeOpener = (pos: number, type: "*" | "_"): boolean => {
        if (pos >= text.length) return false
        const prev = pos > 0 ? text[pos - 1] : " "
        const next = pos + 1 < text.length ? text[pos + 1] : " "

        if (type === "*") {
            return (
                !/\s/.test(next) &&
                (next !== "*" ||
                    (pos + 2 < text.length && !/\s/.test(text[pos + 2])))
            )
        } else {
            return !/[a-zA-Z0-9]/.test(prev) && /[a-zA-Z0-9]/.test(next)
        }
    }

    const canBeCloser = (pos: number, type: "*" | "_"): boolean => {
        if (pos <= 0) return false
        const prev = pos > 0 ? text[pos - 1] : " "
        const next = pos + 1 < text.length ? text[pos + 1] : " "

        if (type === "*") {
            return (
                !/\s/.test(prev) &&
                (prev !== "*" || (pos - 2 >= 0 && !/\s/.test(text[pos - 2])))
            )
        } else {
            return /[a-zA-Z0-9]/.test(prev) && !/[a-zA-Z0-9]/.test(next)
        }
    }

    while (pos < text.length) {
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
                    pureText: rawText,
                    synthText: rawText,
                    startIndex,
                    endIndex,
                })
                pos += 2
                textStart = pos
                continue
            }
        }

        if (text[pos] === "`") {
            addText(textStart, pos)
            let backtickCount = 1
            while (
                pos + backtickCount < text.length &&
                text[pos + backtickCount] === "`"
            ) {
                backtickCount++
            }

            let searchPos = pos + backtickCount
            let found = false
            while (searchPos < text.length) {
                if (text[searchPos] === "`") {
                    let closeCount = 1
                    while (
                        searchPos + closeCount < text.length &&
                        text[searchPos + closeCount] === "`"
                    ) {
                        closeCount++
                    }
                    if (closeCount === backtickCount) {
                        const codeContent = text.slice(
                            pos + backtickCount,
                            searchPos,
                        )
                        const rawText = text.slice(pos, searchPos + backtickCount)
                        const startIndex = startOffset + pos
                        const endIndex = startOffset + searchPos + backtickCount
                        result.push({ 
                            id: uuid(),
                            type: "CodeSpan", 
                            value: codeContent,
                            rawText,
                            startIndex,
                            endIndex,
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
        }

        if (text[pos] === "<") {
            const end = text.indexOf(">", pos + 1)
            if (end !== -1) {
                const content = text.slice(pos + 1, end)
                if (/^https?:\/\/|^ftp:\/\//i.test(content)) {
                    addText(textStart, pos)
                    const rawText = text.slice(pos, end + 1)
                    const startIndex = startOffset + pos
                    const endIndex = startOffset + end + 1
                    result.push({ 
                        id: uuid(),
                        type: "Autolink", 
                        url: content,
                        rawText,
                        startIndex,
                        endIndex,
                    })
                    pos = end + 1
                    textStart = pos
                    continue
                }
                if (
                    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(
                        content,
                    )
                ) {
                    addText(textStart, pos)
                    const rawText = text.slice(pos, end + 1)
                    const startIndex = startOffset + pos
                    const endIndex = startOffset + end + 1
                    result.push({ 
                        id: uuid(),
                        type: "Autolink", 
                        url: "mailto:" + content,
                        rawText,
                        startIndex,
                        endIndex,
                    })
                    pos = end + 1
                    textStart = pos
                    continue
                }
            }
        }

        if (text[pos] === "<") {
            const htmlTagMatch = text
                .slice(pos)
                .match(/^<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/)
            if (htmlTagMatch) {
                const fullMatch = htmlTagMatch[0]
                const tagName = htmlTagMatch[2].toLowerCase()
                const inlineTags = [
                    "a",
                    "abbr",
                    "acronym",
                    "b",
                    "bdo",
                    "big",
                    "br",
                    "button",
                    "cite",
                    "code",
                    "dfn",
                    "em",
                    "i",
                    "img",
                    "input",
                    "kbd",
                    "label",
                    "map",
                    "object",
                    "output",
                    "q",
                    "samp",
                    "script",
                    "select",
                    "small",
                    "span",
                    "strong",
                    "sub",
                    "sup",
                    "textarea",
                    "time",
                    "tt",
                    "var",
                ]
                if (inlineTags.includes(tagName)) {
                    addText(textStart, pos)
                    const rawText = fullMatch
                    const startIndex = startOffset + pos
                    const endIndex = startOffset + pos + fullMatch.length
                    result.push({ 
                        id: uuid(),
                        type: "HTML", 
                        html: fullMatch,
                        rawText,
                        startIndex,
                        endIndex,
                    })
                    pos += fullMatch.length
                    textStart = pos
                    continue
                }
            }
        }

        if (
            text[pos] === "!" &&
            pos + 1 < text.length &&
            text[pos + 1] === "["
        ) {
            const linkEnd = text.indexOf("]", pos + 2)
            if (linkEnd !== -1) {
                const altText = text.slice(pos + 2, linkEnd)

                if (linkEnd + 1 < text.length && text[linkEnd + 1] === "(") {
                    const linkInfo = parseLinkDestinationAndTitle(
                        text,
                        linkEnd + 1,
                    )
                    if (linkInfo) {
                        addText(textStart, pos)
                        const rawText = text.slice(pos, linkInfo.end)
                        const startIndex = startOffset + pos
                        const endIndex = startOffset + linkInfo.end
                        result.push({
                            id: uuid(),
                            type: "Image",
                            url: linkInfo.url,
                            alt: altText,
                            title: linkInfo.title,
                            children: [],
                            rawText,
                            startIndex,
                            endIndex,
                        })
                        pos = linkInfo.end
                        textStart = pos
                        continue
                    }
                }

                if (linkReferences) {
                    let refLabel = ""
                    let refEnd = linkEnd + 1

                    if (
                        linkEnd + 1 < text.length &&
                        text[linkEnd + 1] === "["
                    ) {
                        const refEndPos = text.indexOf("]", linkEnd + 2)
                        if (refEndPos !== -1) {
                            refLabel = text
                                .slice(linkEnd + 2, refEndPos)
                                .toLowerCase()
                                .trim()
                            refEnd = refEndPos + 1
                        } else {
                            pos = linkEnd + 1
                            continue
                        }
                    } else {
                        refLabel = altText.toLowerCase().trim()
                    }

                    const ref = linkReferences.get(refLabel)
                    if (ref) {
                        addText(textStart, pos)
                        const rawText = text.slice(pos, refEnd)
                        const startIndex = startOffset + pos
                        const endIndex = startOffset + refEnd
                        result.push({
                            id: uuid(),
                            type: "Image",
                            url: ref.url,
                            alt: altText,
                            title: ref.title,
                            children: [],
                            rawText,
                            startIndex,
                            endIndex,
                        })
                        pos = refEnd
                        textStart = pos
                        continue
                    }
                }
            }
        }

        if (text[pos] === "[") {
            const linkEnd = text.indexOf("]", pos + 1)
            if (linkEnd !== -1) {
                const linkText = text.slice(pos + 1, linkEnd)

                if (linkEnd + 1 < text.length && text[linkEnd + 1] === "(") {
                    const linkInfo = parseLinkDestinationAndTitle(
                        text,
                        linkEnd + 1,
                    )
                    if (linkInfo) {
                        addText(textStart, pos)
                        const linkStartIndex = startOffset + pos + 1
                        const linkChildren =
                            linkText.trim() === ""
                                ? [
                                      {
                                          id: uuid(),
                                          type: "Text",
                                          value: linkInfo.url,
                                          rawText: linkInfo.url,
                                          startIndex: linkStartIndex,
                                          endIndex: linkStartIndex + linkInfo.url.length,
                                      } as Inline,
                                  ]
                                : parseInline(linkText, linkReferences, linkStartIndex)
                        const rawText = text.slice(pos, linkInfo.end)
                        const startIndex = startOffset + pos
                        const endIndex = startOffset + linkInfo.end
                        result.push({
                            id: uuid(),
                            type: "Link",
                            url: linkInfo.url,
                            title: linkInfo.title,
                            children: linkChildren,
                            rawText,
                            startIndex,
                            endIndex,
                        })
                        pos = linkInfo.end
                        textStart = pos
                        continue
                    }
                }

                if (linkReferences) {
                    let refLabel = ""
                    let refEnd = linkEnd + 1

                    if (
                        linkEnd + 1 < text.length &&
                        text[linkEnd + 1] === "["
                    ) {
                        const refEndPos = text.indexOf("]", linkEnd + 2)
                        if (refEndPos !== -1) {
                            refLabel = text
                                .slice(linkEnd + 2, refEndPos)
                                .toLowerCase()
                                .trim()
                            if (refLabel === "") {
                                refLabel = linkText.toLowerCase().trim()
                            }
                            refEnd = refEndPos + 1
                        } else {
                            pos = linkEnd + 1
                            continue
                        }
                    } else {
                        refLabel = linkText.toLowerCase().trim()
                    }

                    const ref = linkReferences.get(refLabel)
                    if (ref) {
                        addText(textStart, pos)
                        const linkStartIndex = startOffset + pos + 1
                        const linkChildren =
                            linkText.trim() === ""
                                ? [{ 
                                    id: uuid(),
                                    type: "Text", 
                                    value: ref.url,
                                    rawText: ref.url,
                                    startIndex: linkStartIndex,
                                    endIndex: linkStartIndex + ref.url.length,
                                } as Inline]
                                : parseInline(linkText, linkReferences, linkStartIndex)
                        const rawText = text.slice(pos, refEnd)
                        const startIndex = startOffset + pos
                        const endIndex = startOffset + refEnd
                        result.push({
                            id: uuid(),
                            type: "Link",
                            url: ref.url,
                            title: ref.title,
                            children: linkChildren,
                            rawText,
                            startIndex,
                            endIndex,
                        })
                        pos = refEnd
                        textStart = pos
                        continue
                    }
                }
            }
        }

        if (text[pos] === "*" || text[pos] === "_") {
            const type = text[pos] as "*" | "_"
            let length = 1
            while (pos + length < text.length && text[pos + length] === type) {
                length++
            }

            const canOpen = canBeOpener(pos, type)
            const canClose = canBeCloser(pos, type)

            if (canOpen || canClose) {
                addText(textStart, pos)
                const rawText = type.repeat(length)
                const startIndex = startOffset + pos
                const endIndex = startOffset + pos + length
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
                    type,
                    length,
                    pos: result.length - 1,
                    canOpen,
                    canClose,
                    node: textNode,
                })

                textStart = pos + length
            }

            pos += length
            continue
        }

        pos++
    }

    addText(textStart, pos)

    processEmphasis(delimiterStack, result)

    return result
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
