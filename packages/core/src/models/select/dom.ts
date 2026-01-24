function getInlineElementFromNode(node: Node): HTMLElement | null {
    const el = node instanceof HTMLElement ? node : node.parentElement
    if (!el) return null
    return el.closest('[data-inline-id]') as HTMLElement | null
}

export { getInlineElementFromNode }
