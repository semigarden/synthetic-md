import type { Block, Inline } from '../../types'

type InlineHit = { inline: Inline; position: number }

function findClosestInlineAndPosition(
    rootElement: HTMLElement,
    block: Block,
    clickX: number,
    clickY: number,
    getInlineById: (id: string) => Inline | null
): InlineHit | null {
    const blockElement = rootElement.querySelector(
        `[data-block-id="${block.id}"]`
    ) as HTMLElement | null
    if (!blockElement) return null

    const inlineElements = Array.from(
        blockElement.querySelectorAll('[data-inline-id]')
    ) as HTMLElement[]
    if (inlineElements.length === 0) return null

    let closestInline: HTMLElement | null = null
    let minDistance = Infinity
    let horizontallyAlignedInline: HTMLElement | null = null
    let minVerticalDistance = Infinity

    for (const inlineEl of inlineElements) {
        const rect = inlineEl.getBoundingClientRect()
        const isHorizontallyAligned = clickX >= rect.left && clickX <= rect.right

        if (isHorizontallyAligned) {
            const verticalDistance = Math.abs(clickY - (rect.top + rect.height / 2))
            if (verticalDistance < minVerticalDistance) {
                minVerticalDistance = verticalDistance
                horizontallyAlignedInline = inlineEl
            }
        } else {
            const horizontalDistance = Math.min(
                Math.abs(clickX - rect.left),
                Math.abs(clickX - rect.right)
            )
            const verticalDistance = Math.abs(clickY - (rect.top + rect.height / 2))
            const distance = horizontalDistance + verticalDistance

            if (distance < minDistance) {
                minDistance = distance
                closestInline = inlineEl
            }
        }
    }

    if (horizontallyAlignedInline) closestInline = horizontallyAlignedInline
    if (!closestInline) return null

    const inlineId = closestInline.dataset.inlineId
    if (!inlineId) return null

    let inline = getInlineById(inlineId)
    if (!inline) return null

    const rect = closestInline.getBoundingClientRect()
    const relativeX = Math.max(0, Math.min(rect.width, clickX - rect.left))
    const textLength = inline.text.symbolic.length

    let position = Math.round((relativeX / Math.max(1, rect.width)) * textLength)

    const projectedClickY = rect.top + rect.height / 2

    const docAny = document as any

    if (document.caretRangeFromPoint) {
        const range = document.caretRangeFromPoint(clickX, projectedClickY)
        if (range) {
            let targetInlineEl = closestInline
            let targetRect = rect

            if (!closestInline.contains(range.startContainer)) {
                const rangeInlineEl = (
                    range.startContainer.nodeType === Node.TEXT_NODE
                        ? range.startContainer.parentElement
                        : (range.startContainer as HTMLElement)
                )?.closest('[data-inline-id]') as HTMLElement | null

                if (rangeInlineEl && blockElement.contains(rangeInlineEl)) {
                    targetInlineEl = rangeInlineEl
                    targetRect = rangeInlineEl.getBoundingClientRect()

                    const rangeInlineId = rangeInlineEl.dataset.inlineId
                    if (rangeInlineId) {
                        const rangeInline = getInlineById(rangeInlineId)
                        if (rangeInline) {
                            inline = rangeInline
                            const newRelativeX = Math.max(
                                0,
                                Math.min(targetRect.width, clickX - targetRect.left)
                            )
                            position = Math.round(
                                (newRelativeX / Math.max(1, targetRect.width)) *
                                    rangeInline.text.symbolic.length
                            )
                        }
                    }
                }
            }

            if (targetInlineEl.contains(range.startContainer) || targetInlineEl === range.startContainer) {
                const tempRange = document.createRange()
                tempRange.selectNodeContents(targetInlineEl)
                tempRange.setEnd(range.startContainer, range.startOffset)
                const rangePosition = tempRange.toString().length
                if (rangePosition >= 0 && rangePosition <= inline.text.symbolic.length) {
                    position = rangePosition
                }
            }
        }
    } else if (docAny.caretPositionFromPoint) {
        const caretPos = docAny.caretPositionFromPoint(clickX, projectedClickY)
        if (caretPos) {
            const range = document.createRange()
            range.setStart(caretPos.offsetNode, caretPos.offset)
            range.collapse(true)

            if (closestInline.contains(range.startContainer) || closestInline === range.startContainer) {
                const tempRange = document.createRange()
                tempRange.selectNodeContents(closestInline)
                tempRange.setEnd(range.startContainer, range.startOffset)
                const rangePosition = tempRange.toString().length
                if (rangePosition >= 0 && rangePosition <= inline.text.symbolic.length) {
                    position = rangePosition
                }
            }
        }
    }

    position = Math.max(0, Math.min(position, inline.text.symbolic.length))
    return { inline, position }
}

function resolveTextNodeAt(
    inlineEl: HTMLElement,
    offset: number
): { node: Text; offset: number } | null {
    let remaining = offset

    for (const child of inlineEl.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
            const text = child as Text
            if (remaining <= text.length) return { node: text, offset: remaining }
            remaining -= text.length
        } else if (child instanceof HTMLElement) {
            const len = child.textContent?.length ?? 0
            if (remaining <= len) {
                const text = child.firstChild
                if (text instanceof Text) return { node: text, offset: remaining }
                return null
            }
            remaining -= len
        }
    }

    const last = inlineEl.lastChild
    if (last instanceof Text) return { node: last, offset: last.length }

    return null
}

export { findClosestInlineAndPosition, resolveTextNodeAt }
export type { InlineHit }
