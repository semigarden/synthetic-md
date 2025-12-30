import Engine from '../engine/engine'
import { renderAST, patchDOM } from '../render/render'
import css from './SyntheticText.scss?inline'

export class SyntheticText extends HTMLElement {
    private root: ShadowRoot
    private styled = false
    private contentEl?: HTMLDivElement
    private engine = new Engine()
    private connected = false
    private focusedInlineId: string | null = null
    private caretPosition: number = 0
    private initialRenderDone = false

    constructor() {
        super()
        this.root = this.attachShadow({ mode: 'open' })
    }

    connectedCallback() {
        this.connected = true
        this.engine = new Engine(this.textContent ?? '')
        this.ensureStyle()
        this.ensureDom()
        this.render()
    }

    set value(value: string) {
        this.engine.setSource(value)
        if (this.connected) {
            this.patch()
        }
    }

    get value() {
        return this.engine.getSource()
    }

    private render() {
        if (!this.contentEl) return
        const ast = this.engine.getAst()
        renderAST(ast, this.contentEl, this.focusedInlineId)
        this.initialRenderDone = true
        this.restoreCaret()
    }

    private patch() {
        if (!this.contentEl) return
        const diff = this.engine.getLastDiff()
        if (!diff || !this.initialRenderDone) {
            this.render()
            return
        }
        patchDOM(diff, this.contentEl, this.focusedInlineId)
        this.restoreCaret()
    }

    private restoreCaret() {
        if (this.caretPosition == null || !this.contentEl) return

        const sel = window.getSelection()
        if (!sel) return

        let remaining = this.caretPosition
        let targetNode: Node | null = null
        let offset = 0

        const walk = (node: Node): boolean => {
            if (node.nodeType === Node.TEXT_NODE) {
                const parentInlineId = (node.parentElement)?.dataset.inlineId
                let nodeLength = node.textContent?.length ?? 0

                if (parentInlineId) {
                    const inline = this.engine.getInlineById(parentInlineId)
                    if (inline) {
                        nodeLength = parentInlineId === this.focusedInlineId
                            ? inline.text.symbolic.length
                            : inline.text.semantic.length
                    }
                }

                if (remaining <= nodeLength) {
                    targetNode = node
                    offset = remaining
                    return true
                }

                remaining -= nodeLength
            }

            for (let child = node.firstChild; child; child = child.nextSibling) {
                if (walk(child)) return true
            }

            return false
        }

        walk(this.contentEl)

        if (targetNode) {
            const range = document.createRange()
            range.setStart(targetNode, offset)
            range.collapse(true)
            sel.removeAllRanges()
            sel.addRange(range)
        }
    }

    private ensureStyle() {
        if (this.styled) return
    
        const style = document.createElement('style')
        style.textContent = css
        this.root.appendChild(style)
    
        this.styled = true
    }

    private ensureDom() {
        if (this.contentEl) return
    
        const div = document.createElement('div')
        div.classList.add('syntheticText')
        div.contentEditable = 'true'

        const getCaretPosition = (): number => {
            const selection = window.getSelection()
            if (!selection || !selection.anchorNode) return 0

            const anchorNode = selection.anchorNode
            const anchorOffset = selection.anchorOffset

            let charCount = 0

            const walkNodes = (node: Node): boolean => {
                if (node === anchorNode) {
                    charCount += anchorOffset
                    return true
                }

                if (node.nodeType === Node.TEXT_NODE) {
                    charCount += node.textContent?.length ?? 0
                }

                for (let child = node.firstChild; child; child = child.nextSibling) {
                    if (walkNodes(child)) return true
                }

                return false
            }

            walkNodes(div)
            return charCount
        }

        div.addEventListener('click', (e) => {
            const position = getCaretPosition()
            this.caretPosition = position
            this.focusedInlineId = this.engine.getInlineIdByPosition(position)
            this.render()
        })

        div.addEventListener('focusin', () => {})
        div.addEventListener('focusout', () => {})

        div.addEventListener('input', () => {
            const next = div.textContent ?? ''
            this.engine.setSource(next)
            this.patch()
            this.dispatchEvent(
              new CustomEvent('change', {
                detail: { value: next },
                bubbles: true,
                composed: true,
              })
            )
        })
    
        this.root.appendChild(div)
        this.contentEl = div
    }
}
