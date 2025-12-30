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
            console.log('click', position)
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
