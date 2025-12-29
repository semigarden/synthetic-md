import Engine from '../engine/engine'
import css from './SyntheticText.scss?inline'

export class SyntheticText extends HTMLElement {
    private root: ShadowRoot
    private styled = false
    private contentEl?: HTMLDivElement
    private _value = ''

    private engine = new Engine()

    constructor() {
        super()
        this.root = this.attachShadow({ mode: 'open' })
    }

    connectedCallback() {
        this.engine = new Engine(this.textContent ?? '')
        this.ensureStyle()
        this.ensureDom()
    }

    set value(value: string) {
        if (value === this._value) return
        this._value = value
        if (this.contentEl) {
            this.contentEl.textContent = value
        }
    }

    get value() {
        return this._value
    }

    private onInput(next: string) {
        this.engine.setSource(next)
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
        div.textContent = this._value

        div.addEventListener('input', () => {
            const next = div.textContent ?? ''
            this._value = next

            this.onInput(next)
      
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
