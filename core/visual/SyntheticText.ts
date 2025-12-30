import Engine from '../engine/engine'
import { renderAST } from '../render/render'
import css from './SyntheticText.scss?inline'

export class SyntheticText extends HTMLElement {
    private root: ShadowRoot
    private styled = false
    private contentEl?: HTMLDivElement
    private engine = new Engine()
    private connected = false
    private mode : 'symbolic' | 'synthetic' = 'synthetic'
    private focusedInlineId: string | null = null
    private caretPosition: number = 0

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
            this.render()
        }
    }

    get value() {
        return this.engine.getSource()
    }

    private render() {
        if (!this.contentEl) return

        const ast = this.engine.getAst()
        // console.log('ast', JSON.stringify(ast, null, 2))
        renderAST(ast, this.contentEl!, this.focusedInlineId)
        console.log('render', this.focusedInlineId)
        console.log('caretPosition', this.caretPosition)

        this.restoreCaret()
    }

    private restoreCaret() {
        if (this.caretPosition == null || !this.contentEl) return;

    const sel = window.getSelection();
    if (!sel) return;

    let remaining = this.caretPosition;
    let targetNode: Node | null = null;
    let offset = 0;

    const walk = (node: Node): boolean => {
        if (node.nodeType === Node.TEXT_NODE) {
            const parentInlineId = (node.parentElement)?.dataset.inlineId;
            let nodeLength = node.textContent?.length ?? 0;

            // Decide whether to use symbolic or semantic length
            if (parentInlineId) {
                const inline = this.engine.getInlineById(parentInlineId);
                if (inline) {
                    nodeLength = parentInlineId === this.focusedInlineId
                        ? inline.text.symbolic.length
                        : inline.text.semantic.length;
                }
            }

            if (remaining <= nodeLength) {
                targetNode = node;
                offset = remaining;
                return true;
            }

            remaining -= nodeLength;
        }

        for (let child = node.firstChild; child; child = child.nextSibling) {
            if (walk(child)) return true;
        }

        return false;
    };

    walk(this.contentEl);

    if (targetNode) {
        const range = document.createRange();
        range.setStart(targetNode, offset);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
    }
    }

    private onInput(next: string) {
        this.engine.setSource(next)
        // this.render()
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
            console.log('click', position, this.focusedInlineId)
            this.render()
        })

        div.addEventListener('focusin', (e) => {
            // const selection = window.getSelection()
            // if (!selection || !selection.anchorNode) return

            // let el: HTMLElement | null = null
            // if (selection.anchorNode.nodeType === Node.TEXT_NODE) {
            //     el = selection.anchorNode.parentElement as HTMLElement
            // } else if (selection.anchorNode.nodeType === Node.ELEMENT_NODE) {
            //     el = selection.anchorNode as HTMLElement
            // }

            // const inlineEl = el?.closest('[data-inline-id]') as HTMLElement | null
            // this.focusedInlineId = inlineEl?.dataset.inlineId ?? null

            // // console.log('focusin', this.focusedInlineId)
            // this.render()
        })


        div.addEventListener('focusout', (e) => {
            // const related = e.relatedTarget as HTMLElement | null

            // const el = related?.closest('[data-inline-id]') as HTMLElement | null
            // const sameInline = el?.dataset.inlineId

            // if (sameInline === this.focusedInlineId) return

            // this.focusedInlineId = null

            
            // this.render()
        })

        div.addEventListener('input', () => {
            const next = div.textContent ?? ''
            this.engine.setSource(next)
            // this.render()

            // this.onInput(next)
      
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
