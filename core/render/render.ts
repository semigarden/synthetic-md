import { Document, Block, Inline } from '../ast/types'
import { AstDiff, BlockDiff, InlineDiff } from '../diff/diff'

export function renderAST(
    ast: Document,
    container: HTMLElement,
    focusedInlineId: string | null = null,
) {
    container.textContent = ''
    for (const block of ast.blocks) {
        container.appendChild(renderBlock(block, focusedInlineId))
    }
}

export function patchDOM(
    diff: AstDiff,
    container: HTMLElement,
    focusedInlineId: string | null = null,
): void {
    if (!diff.hasChanges) return

    const removals: BlockDiff[] = []
    const updates: BlockDiff[] = []
    const additions: BlockDiff[] = []

    for (const blockDiff of diff.blockDiffs) {
        if (blockDiff.type === 'remove') removals.push(blockDiff)
        else if (blockDiff.type === 'update') updates.push(blockDiff)
        else if (blockDiff.type === 'add') additions.push(blockDiff)
    }

    for (const blockDiff of removals) {
        const oldId = blockDiff.oldBlock?.id
        if (!oldId) continue
        const el = container.querySelector(`[data-block-id="${oldId}"]`)
        el?.remove()
    }

    for (const blockDiff of updates) {
        const oldId = blockDiff.oldBlock?.id
        const newBlock = blockDiff.newBlock
        if (!oldId || !newBlock) continue

        const el = container.querySelector(`[data-block-id="${oldId}"]`) as HTMLElement
        if (!el) continue

        el.id = newBlock.id
        el.dataset.blockId = newBlock.id

        if (blockDiff.inlineDiffs) {
            patchInlines(blockDiff.inlineDiffs, el, focusedInlineId, newBlock.inlines)
        }
    }

    for (const blockDiff of additions) {
        const newBlock = blockDiff.newBlock
        if (!newBlock) continue

        const newEl = renderBlock(newBlock, focusedInlineId)
        const children = Array.from(container.children)

        if (blockDiff.index >= children.length) {
            container.appendChild(newEl)
        } else {
            container.insertBefore(newEl, children[blockDiff.index])
        }
    }
}

function patchInlines(
    diffs: InlineDiff[],
    parent: HTMLElement,
    focusedInlineId: string | null,
    newInlines: Inline[],
): void {
    const removals: InlineDiff[] = []
    const updates: InlineDiff[] = []
    const additions: InlineDiff[] = []

    for (const diff of diffs) {
        if (diff.type === 'remove') removals.push(diff)
        else if (diff.type === 'update') updates.push(diff)
        else if (diff.type === 'add') additions.push(diff)
    }

    for (const diff of removals) {
        const oldId = diff.oldInline?.id
        if (!oldId) continue
        const el = parent.querySelector(`[data-inline-id="${oldId}"]`)
        el?.remove()
    }

    for (const diff of updates) {
        const oldId = diff.oldInline?.id
        const newInline = diff.newInline
        if (!oldId || !newInline) continue

        const el = parent.querySelector(`[data-inline-id="${oldId}"]`) as HTMLElement
        if (!el) continue

        const isFocused = newInline.id === focusedInlineId
        el.id = newInline.id
        el.dataset.inlineId = newInline.id
        el.textContent = isFocused ? newInline.text.symbolic : newInline.text.semantic

        if (diff.childDiffs && 'inlines' in newInline) {
            patchInlines(diff.childDiffs, el, focusedInlineId, (newInline as any).inlines)
        }
    }

    for (const diff of additions) {
        const newInline = diff.newInline
        if (!newInline) continue

        const newEl = renderInline(newInline, focusedInlineId)
        const children = Array.from(parent.childNodes)

        if (diff.index >= children.length) {
            parent.appendChild(newEl)
        } else {
            parent.insertBefore(newEl, children[diff.index])
        }
    }
}

function renderBlock(block: Block, focusedInlineId: string | null): HTMLElement {
    switch (block.type) {
        case 'paragraph': {
            const el = document.createElement('p')
            el.id = block.id
            el.dataset.blockId = block.id
            renderInlines(block.inlines, el, focusedInlineId)
            return el
        }

        case 'heading': {
            const el = document.createElement(`h${block.level}`)
            el.id = block.id
            el.dataset.blockId = block.id
            renderInlines(block.inlines, el, focusedInlineId)
            return el
        }

        default:
            return document.createElement('div')
    }
}

function renderInlines(
    inlines: Inline[],
    parent: HTMLElement,
    focusedInlineId: string | null,
) {
    for (const inline of inlines) {
        parent.appendChild(renderInline(inline, focusedInlineId))
    }
}

function renderInline(inline: Inline, focusedInlineId: string | null): Node {
    const isFocused = inline.id === focusedInlineId

    if (isFocused) {
        const span = document.createElement('span')
        span.id = inline.id
        span.dataset.inlineId = inline.id
        span.textContent = inline.text.symbolic
        return span
    }

    switch (inline.type) {
        case 'text':
            const el = document.createElement('span')
            el.id = inline.id
            el.dataset.inlineId = inline.id
            el.textContent = inline.text.semantic
            return el

        case 'emphasis': {
            const el = document.createElement('em')
            el.id = inline.id
            el.dataset.inlineId = inline.id

            for (const child of inline.inlines) {
                el.appendChild(renderInline(child, focusedInlineId))
            }
            return el
        }

        case 'strong': {
            const el = document.createElement('strong')
            el.id = inline.id
            el.dataset.inlineId = inline.id

            for (const child of inline.inlines) {
                el.appendChild(renderInline(child, focusedInlineId))
            }
            return el
        }

        default:
            return document.createTextNode('')
    }
}
