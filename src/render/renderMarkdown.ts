import { parseBlock } from "../parse/parseBlock"
import { renderBlock } from "../render/renderBlock"

const renderMarkdown = (markdown: string) => {
    const document = parseBlock(markdown)
    return renderBlock(document)
}

export { renderMarkdown }
