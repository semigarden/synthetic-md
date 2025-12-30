import Engine from '../engine/engine'
import Caret from './caret'
import { renderAST } from '../render/render'
import css from './SyntheticText.scss?inline'

export class SyntheticText extends HTMLElement {
    private root: ShadowRoot
    private styled = false
    private contentEl?: HTMLDivElement
    private engine = new Engine()
    private caret = new Caret()
    private connected = false
    private isRendered = false

    constructor() {
        super()
        this.root = this.attachShadow({ mode: 'open' })
    }

    connectedCallback() {
        this.connected = true
        this.engine = new Engine(this.textContent ?? '')
        this.addStyles()
        this.addDOM()
    }

    set value(value: string) {
        this.engine.setText(value)
        if (this.connected && !this.isRendered) {
          this.render()
        }
    }

    get value() {
        return this.engine.getText()
    }

    private render() {
        if (!this.contentEl) return
        const ast = this.engine.getAst()
        if (!ast) return

        console.log('render', JSON.stringify(ast, null, 2))

        renderAST(ast, this.contentEl)
    }

    private addStyles() {
        if (this.styled) return
    
        const style = document.createElement('style')
        style.textContent = css
        this.root.appendChild(style)
    
        this.styled = true
    }

    private addDOM() {
        if (this.contentEl) return
    
        const div = document.createElement('div')
        div.classList.add('syntheticText')
  
        // div.addEventListener('input', () => {
        //     const next = div.textContent ?? ''
        //     this.engine.setText(next)

        //     this.patch()


        //     this.dispatchEvent(new CustomEvent('change', {
        //         detail: { value: next },
        //         bubbles: true,
        //         composed: true,
        //     }))
        // })
    
        this.root.appendChild(div)
        this.contentEl = div
    }
}
