import type { Block, CodeBlock, HTMLBlock, List, ListItem } from "../types/block"
import { renderInline } from "./renderInline"
import { escape } from "../utils/escape"

type Perspective = {
    cursor: number | null
    vision: "pure" | "synthetic"
}

function renderBlock(block: Block, perspective: Perspective): string {
    switch (block.type) {
        case "document":
            return block.children.map((child) => renderBlock(child, perspective)).join("")

        case "heading":
            const tag = perspective.vision === "synthetic"
                ? `h${block.level}`
                : "span"

            return `<${tag}>${block.children.map((child) => renderInline(child, perspective)).join("")}</${tag}>`

        case "paragraph":
            return `<p>${block.children.map((child) => renderInline(child, perspective)).join("")}</p>`

        case "blockQuote":
            return `<blockquote>${block.children.map((child) => renderBlock(child, perspective)).join("")}</blockquote>`

        case "thematicBreak":
            return `<hr />`

        case "codeBlock": {
            const codeBlock = block as CodeBlock
            const lang = codeBlock.language
                ? ` class="language-${escape(codeBlock.language)}"`
                : ""
            return `<pre><code${lang}>${escape(codeBlock.code)}</code></pre>`
        }

        case "htmlBlock":
            return (block as HTMLBlock).html

        case "lineBreak":
            return "<br />"

        case "list": {
            const list = block as List
            const tag = list.ordered ? "ol" : "ul"
            const startAttr =
                list.ordered && list.start !== undefined && list.start !== 1
                    ? ` start="${list.start}"`
                    : ""
            return `<${tag}${startAttr}>${list.children.map((child) => renderBlock(child, perspective)).join("")}</${tag}>`
        }

        case "listItem":
            return `<li>${(block as ListItem).children.map((child) => renderBlock(child, perspective)).join("")}</li>`

        default:
            return ""
    }
}

export { renderBlock }
