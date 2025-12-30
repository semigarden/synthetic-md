import Engine from '../engine/engine'
import { patchDOM, renderFull } from '../render/render'
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
        if (this.connected && this.initialRenderDone) {
          this.patch()
        } else if (this.connected) {
          this.render()
        }
    }

    get value() {
        return this.engine.getSource()
    }

    private render() {
        if (!this.contentEl) return
        const ast = this.engine.getAst()
        renderFull(ast, this.contentEl, this.focusedInlineId)
        this.initialRenderDone = true
        this.restoreCaret()
    }

    private patch() {
        if (!this.contentEl || !this.initialRenderDone) {
          this.render()
          return
        }
      
        const changes = this.engine.getLastDiff()
      
        if (changes.length === 0) {
          return
        }
      
        patchDOM(changes, this.contentEl, this.focusedInlineId)
      
        this.restoreCaret()
    }

    private getCaretPosition(div: HTMLElement): number {
        if (!div) return 0
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

    private getInlineIdFromNode(node: Node | null): string | null {
        if (!node) return null
      
        let el: HTMLElement | null =
          node.nodeType === Node.TEXT_NODE
            ? node.parentElement
            : (node as HTMLElement)
      
        if (!el) return null
      
        const formattingParent = el.closest('em, strong, a') as HTMLElement
        if (formattingParent && formattingParent.dataset.inlineId) {
          return formattingParent.dataset.inlineId
        }
      
        const inlineEl = el.closest('[data-inline-id]') as HTMLElement
        return inlineEl?.dataset.inlineId ?? null
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


          const updateFocusedInlineFromSelection = () => {
            const sel = window.getSelection()
            if (!sel || sel.rangeCount === 0) return
        
            const anchorNode = sel.anchorNode
            const newFocusedId = this.getInlineIdFromNode(anchorNode)

            if (newFocusedId !== this.focusedInlineId) {
                if (this.focusedInlineId) {
                    const prevInline = this.engine.getInlineById(this.focusedInlineId)
                    if (prevInline) {
                        const prevInlineElement = this.root.getElementById(this.focusedInlineId)
                        if (prevInlineElement) {
                            prevInlineElement.textContent = prevInline.text.semantic
                        }
                    }
                }

              this.focusedInlineId = newFocusedId
              this.caretPosition = this.getCaretPosition(div)

              if (newFocusedId) {
                const inline = this.engine.getInlineById(newFocusedId)

                if (inline) {
                    const inlineElement = this.root.getElementById(newFocusedId)

                    if (inlineElement) {
                        inlineElement.textContent = inline.text.symbolic

                    }
                }
              }
            this.patch()
            }
          }

        div.addEventListener('click', (e) => {
            requestAnimationFrame(() => {
                updateFocusedInlineFromSelection()
            })
        })
        
        document.addEventListener('selectionchange', () => {
        if (document.activeElement === div) {
            updateFocusedInlineFromSelection()
        }
        })
    
        document.addEventListener('mousedown', (e) => {
            console.log('mousedown', this.focusedInlineId)
        if (!this.root.host.contains(e.target as Node)) {
            
            if (this.focusedInlineId !== null) {
                const inlineElement = this.root.getElementById(this.focusedInlineId)
                if (inlineElement) {
                    const inline = this.engine.getInlineById(this.focusedInlineId)
                    if (inline) {
                        inlineElement.textContent = inline.text.semantic
                    }
                }

            this.focusedInlineId = null
            this.caretPosition = 0
            this.patch()
            }
        }
        }, true)
        div.addEventListener('input', () => {
            const next = div.textContent ?? ''
            this.engine.setSource(next)
            this.patch()

            requestAnimationFrame(() => {
                this.caretPosition = this.getCaretPosition(div)
              })

            this.dispatchEvent(new CustomEvent('change', {
            detail: { value: next },
            bubbles: true,
            composed: true,
            }))
        })
    
        this.root.appendChild(div)
        this.contentEl = div
    }
}
