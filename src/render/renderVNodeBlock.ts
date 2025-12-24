import type { Block } from "../types/block"
import type { VNode } from "../types/node"

export function renderVNodeBlock(block: Block, perspective: { cursor: number | null, vision: "pure" | "synthetic" }): VNode {
  const base: VNode = {
    type: "",
    id: block.id,
    children: [],
    startIndex: block.startIndex,
    endIndex: block.endIndex,
  }

  switch (block.type) {
    case "document":
      base.type = "div"
      base.children = block.children.map((child) => renderVNodeBlock(child, perspective))
      break

    case "paragraph":
      base.type = "p"
      base.children = block.children.map((child) => ({
        type: "span",
        id: `${block.id}-${child.id}`,
        text: child.rawText,
        startIndex: child.startIndex,
        endIndex: child.endIndex,
        focus: perspective.cursor !== null && perspective.cursor >= child.startIndex! && perspective.cursor <= child.endIndex!,
      } as VNode))
      break

    case "heading":
      base.type = perspective.vision === "synthetic" ? `h${block.level}` : "span"
      base.children = block.children.map((child) => ({
        type: "span",
        id: `${block.id}-${child.id}`,
        text: child.rawText,
        startIndex: child.startIndex,
        endIndex: child.endIndex,
        focus: perspective.cursor !== null && perspective.cursor >= child.startIndex! && perspective.cursor <= child.endIndex!,
      } as VNode))
      break

    case "codeBlock":
      base.type = "pre"
      base.children = [
        {
          type: "code",
          id: `${block.id}-code`,
          text: block.rawText,
          startIndex: block.startIndex,
          endIndex: block.endIndex,
          focus: perspective.cursor !== null && perspective.cursor >= block.startIndex! && perspective.cursor <= block.endIndex!,
        },
      ] as VNode[]
      break

    case "lineBreak":
      base.type = "br"
      break

    case "thematicBreak":
      base.type = "hr"
      break

    case "list":
      base.type = block.ordered ? "ol" : "ul"
      base.children = block.children.map((child) => renderVNodeBlock(child, perspective))
      break

    case "listItem":
      base.type = "li"
      base.children = block.children.map((child) => renderVNodeBlock(child, perspective))
      break

    case "blockQuote":
      base.type = "blockquote"
      base.children = block.children.map((child) => renderVNodeBlock(child, perspective))
      break

    case "htmlBlock":
      base.type = "div"
      base.text = block.html
      break

    default:
      base.type = "span"
      base.text = ""
  }

  return base
}
