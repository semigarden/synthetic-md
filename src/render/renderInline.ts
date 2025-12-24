import { escape } from "../utils/escape"
import type { Inline } from "../types/inline"

type Perspective = {
    cursor: number | null
    vision: "pure" | "synthetic"
}

function isCursorIn(inline: Inline, cursor: number | null): boolean {
    if (cursor === null) return false
    return cursor >= inline.startIndex && cursor <= inline.endIndex
}

function renderInline(inline: Inline, perspective: Perspective): string {
    console.log(perspective.vision, 'inline', JSON.stringify(inline, null, 2))
    switch (inline.type) {
        case "Text":
            if (perspective.vision === "synthetic") {
                return escape(inline.synthText)
            }
            return escape(inline.pureText)
        case "Emphasis":
            return `<em>${inline.children.map((child) => renderInline(child, perspective)).join("")}</em>`
        case "Strong":
            console.log('renderInline', perspective.vision, perspective.cursor)
            if (isCursorIn(inline, perspective.cursor)) {
                console.log('isCursorIn', inline.startIndex, inline.endIndex, perspective.cursor)
                return `<span
                    data-start="${inline.startIndex}"
                    data-end="${inline.endIndex}"
                >${escape(inline.rawText)}</span>`
            }
            return `<strong
                data-start="${inline.startIndex}"
                data-end="${inline.endIndex}"
            >${inline.children.map((child) => renderInline(child, perspective)).join("")}</strong>`
        case "CodeSpan":
            return `<code>${escape(inline.value)}</code>`
        case "Link": {
            const linkTitle = inline.title
                ? ` title="${escape(inline.title)}"`
                : ""
            return `<a href="${escape(inline.url)}"${linkTitle}>${inline.children.map((child) => renderInline(child, perspective)).join("")}</a>`
        }
        case "Image": {
            const imgTitle = inline.title
                ? ` title="${escape(inline.title)}"`
                : ""
            return `<img src="${escape(inline.url)}" alt="${escape(inline.alt)}"${imgTitle} />`
        }
        case "Autolink":
            return `<a href="${escape(inline.url)}">${escape(inline.url)}</a>`
        case "HTML":
            return inline.html
        case "SoftBreak":
            return " "
        case "HardBreak":
            return "<br />"
    }
}

export { renderInline }
