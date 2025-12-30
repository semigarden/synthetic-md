import Engine from '../engine/engine'
import { patchDOM, renderFull } from '../render/render'
import { renderInlines } from '../render/renderInline'
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

        if (changes.length > 0) {
            patchDOM(changes, this.contentEl, this.focusedInlineId)
        } else {
            // Visual change (formatting added/removed, focus change)
            // Re-render all inlines to show symbolic/semantic correctly
            const blocks = this.contentEl.querySelectorAll('[data-block-id]')
            const ast = this.engine.getAst()
            blocks.forEach((blockEl: any) => {
            const blockId = blockEl.dataset.blockId
            if (!blockId) return
            const block = ast.blocks.find(b => b.id === blockId)
            if (block) {
                blockEl.textContent = ''
                renderInlines(block.inlines, blockEl, this.focusedInlineId)
            }
            })
        }

        // Always restore caret after any patch
        requestAnimationFrame(() => this.restoreCaret())
    }

    // private getCaretPosition(div: HTMLElement): number {
    //     if (!div) return 0
    //     const selection = window.getSelection()
    //     if (!selection || !selection.anchorNode) return 0

    //     const anchorNode = selection.anchorNode
    //     const anchorOffset = selection.anchorOffset

    //     let charCount = 0

    //     const walkNodes = (node: Node): boolean => {
    //         if (node === anchorNode) {
    //             charCount += anchorOffset
    //             return true
    //         }

    //         if (node.nodeType === Node.TEXT_NODE) {
    //             charCount += node.textContent?.length ?? 0
    //         }

    //         for (let child = node.firstChild; child; child = child.nextSibling) {
    //             if (walkNodes(child)) return true
    //         }

    //         return false
    //     }

    //     walkNodes(div)
    //     return charCount
    // }
    private getCaretPosition(): number {
        const sel = window.getSelection()
        if (!sel || sel.rangeCount === 0) return 0
      
        const range = sel.getRangeAt(0)
        const preRange = range.cloneRange()
        preRange.selectNodeContents(this.contentEl!)
        preRange.setEnd(range.endContainer, range.endOffset)
        return preRange.toString().length
    }

    // private restoreCaret() {
    //     if (this.caretPosition == null || !this.contentEl) return

    //     const sel = window.getSelection()
    //     if (!sel) return

    //     let remaining = this.caretPosition
    //     let targetNode: Node | null = null
    //     let offset = 0

    //     const walk = (node: Node): boolean => {
    //         if (node.nodeType === Node.TEXT_NODE) {
    //             const parentInlineId = (node.parentElement)?.dataset.inlineId
    //             let nodeLength = node.textContent?.length ?? 0

    //             if (parentInlineId) {
    //                 const inline = this.engine.getInlineById(parentInlineId)
    //                 if (inline) {
    //                     nodeLength = parentInlineId === this.focusedInlineId
    //                         ? inline.text.symbolic.length
    //                         : inline.text.semantic.length
    //                 }
    //             }

    //             if (remaining <= nodeLength) {
    //                 targetNode = node
    //                 offset = remaining
    //                 return true
    //             }

    //             remaining -= nodeLength
    //         }

    //         for (let child = node.firstChild; child; child = child.nextSibling) {
    //             if (walk(child)) return true
    //         }

    //         return false
    //     }

    //     walk(this.contentEl)

    //     if (targetNode) {
    //         const range = document.createRange()
    //         range.setStart(targetNode, offset)
    //         range.collapse(true)
    //         sel.removeAllRanges()
    //         sel.addRange(range)
    //     }
    // }
    private restoreCaret() {
        if (this.caretPosition == null || !this.contentEl) return

        const sel = window.getSelection()
        if (!sel) return

        let remaining = this.caretPosition
        let targetNode: Node | null = null
        let offset = 0

        const walk = (node: Node): boolean => {
            if (node.nodeType === Node.TEXT_NODE) {
            const length = node.textContent?.length ?? 0
            if (remaining <= length) {
                targetNode = node
                offset = remaining
                return true
            }
            remaining -= length
            }

            for (let child = node.firstChild; child; child = child.nextSibling) {
            if (walk(child)) return true
            }
            return false
        }

        walk(this.contentEl)

        if (targetNode) {
            const range = document.createRange()
            range.setStart(targetNode, Math.min(offset, (targetNode as Text).textContent?.length ?? 0))
            range.collapse(true)
            sel.removeAllRanges()
            sel.addRange(range)
        } else {
            // Fallback: if we can't find the exact position, try to place caret in focused inline
            // or at the end of the content
            if (this.focusedInlineId) {
                const inlineElement = this.root.getElementById(this.focusedInlineId)
                if (inlineElement) {
                    const lastTextNode = this.getLastTextNode(inlineElement)
                    const node = lastTextNode ?? inlineElement
                    const range = document.createRange()
                    const textLength = node.textContent?.length ?? 0
                    // Try to place caret at a reasonable position (end of focused inline or saved position if within bounds)
                    const targetOffset = Math.min(this.caretPosition, textLength)
                    range.setStart(node, targetOffset)
                    range.collapse(true)
                    sel.removeAllRanges()
                    sel.addRange(range)
                    return
                }
            }
            // Last resort: place caret at end of content
            const lastTextNode = this.getLastTextNode(this.contentEl)
            if (lastTextNode) {
                const range = document.createRange()
                range.setStart(lastTextNode, lastTextNode.textContent?.length ?? 0)
                range.collapse(true)
                sel.removeAllRanges()
                sel.addRange(range)
            }
        }
    }

    private getLastTextNode(node: Node): Text | null {
        if (node.nodeType === Node.TEXT_NODE) {
            return node as Text
        }
        for (let i = node.childNodes.length - 1; i >= 0; i--) {
            const child = node.childNodes[i]
            const result = this.getLastTextNode(child)
            if (result) return result
        }
        return null
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
              this.caretPosition = this.getCaretPosition()

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
            // Update focused inline and save caret position before patching
            const sel = window.getSelection()
            if (sel && sel.rangeCount > 0) {
                const anchorNode = sel.anchorNode
                const newFocusedId = this.getInlineIdFromNode(anchorNode)
                
                // Update focused inline if it changed
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
                }
                
                // Save caret position only if we have a valid selection
                const savedPosition = this.getCaretPosition()
                if (savedPosition >= 0) {
                    this.caretPosition = savedPosition
                }
            }

            const next = div.textContent ?? ''
            this.engine.setSource(next)

            this.patch()

            // patch() calls restoreCaret(), but we need to ensure focused inline is updated
            // after the DOM changes, especially when new inlines are added
            // Use a double requestAnimationFrame to ensure it runs after patch()'s restoreCaret()
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    // Update focused inline based on current selection after patch
                    const sel = window.getSelection()
                    if (sel && sel.rangeCount > 0) {
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
                            
                            if (newFocusedId) {
                                const inline = this.engine.getInlineById(newFocusedId)
                                if (inline) {
                                    const inlineElement = this.root.getElementById(newFocusedId)
                                    if (inlineElement) {
                                        inlineElement.textContent = inline.text.symbolic
                                        // Restore caret again after updating focused inline
                                        this.restoreCaret()
                                    }
                                }
                            }
                        } else if (newFocusedId) {
                            // Ensure focused inline shows symbolic text
                            const inline = this.engine.getInlineById(newFocusedId)
                            if (inline) {
                                const inlineElement = this.root.getElementById(newFocusedId)
                                if (inlineElement && inlineElement.textContent !== inline.text.symbolic) {
                                    inlineElement.textContent = inline.text.symbolic
                                    this.restoreCaret()
                                }
                            }
                        }
                    }
                })
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
