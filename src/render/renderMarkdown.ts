import { parseBlock } from "../parse/parseBlock"
import { renderBlock } from "../render/renderBlock"

const renderMarkdown = (markdown: string) => {
    const ast = parseBlock(markdown)
    return renderBlock(ast, { cursor: 0, vision: "pure" })
}

export { renderMarkdown }
