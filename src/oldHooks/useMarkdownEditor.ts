// import { useCallback, useMemo } from "react"
// // import { renderMarkdown } from "../render/renderMarkdown"
// import { parseBlock } from "../parse/parseBlock"
// import { renderBlock } from "../render/renderBlock"

// type Perspective = {
//     cursor: number | null
//     vision: "pure" | "synthetic"
// }

// function useMarkdownEditor(markdownText?: string, perspective: Perspective = { cursor: 0, vision: "synthetic" }) {
//     const getAst = useCallback((text: string) => {
//         return parseBlock(text)
//     }, [])

//     const render = useCallback(
//         (text: string, perspective: Perspective) => {
//             const ast = getAst(text)
//             return renderBlock(ast, perspective)
//         }, [])

//     const ast = useMemo(() => getAst(markdownText ?? ""), [markdownText])
//     const html = useMemo(() => render(markdownText ?? "", perspective), [markdownText, perspective])

//     return { ast, html, render }
// }

// export { useMarkdownEditor }
// export default useMarkdownEditor


