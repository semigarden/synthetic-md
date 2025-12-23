import { useCallback, useMemo } from "react"
import { renderMarkdown } from "../render/renderMarkdown"

function useMarkdownEditor(markdownText?: string) {
    const render = useCallback(
        (text: string) => renderMarkdown(text || ""),
        [],
    )

    const html = useMemo(() => render(markdownText ?? ""), [markdownText, render])

    return { html, render }
}

export { useMarkdownEditor }
export default useMarkdownEditor


