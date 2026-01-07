import AST from './ast'
import Caret from './caret'
import Selection from './selection'
import Editor from './editor'
import Render from './render'
import scss from '../styles/element.scss?inline'
import { buildAst } from '../ast/ast'
import { renderAST } from '../render/render'
import { onKey } from '../utils/key'

class Element extends HTMLElement {
    private shadowRootElement: ShadowRoot
    private rootElement?: HTMLElement
    private ast = new AST()
    private render: Render | null = null
    private caret: Caret | null = null
    private selection: Selection | null = null
    private editor: Editor | null = null
    private hasAcceptedExternalValue = false
    private styled = false

    constructor() {
        super()
        this.shadowRootElement = this.attachShadow({ mode: 'open' })
    }

    connectedCallback() {
        const attrValue = this.getAttribute('value') ?? ''

        this.ast.text = attrValue
        this.ast.ast = buildAst(attrValue)

        this.addStyles()
        this.addDOM()
        this.renderAST()

        this.render = new Render(this.rootElement!)
        this.caret = new Caret(this.rootElement!)
        this.editor = new Editor(this.ast, this.caret, this.render, this.rootElement!, this.emitChange.bind(this))
        this.selection = new Selection(this.ast, this.caret, this.rootElement!)
        this.selection.attach()
    }

    disconnectedCallback() {
        this.selection?.detach()
        this.caret?.clear()
    }

    set value(value: string) {
        if (value === this.ast.text) return

        if (!this.hasAcceptedExternalValue && value !== '') {
            this.ast.text = value
            this.ast.ast = buildAst(value)
            this.renderAST()
            this.hasAcceptedExternalValue = true
        }
    }

    get value() {
        return this.ast.text
    }

    private renderAST() {
        if (!this.rootElement) return
        const ast = this.ast.ast
        if (!ast) return

        renderAST(ast, this.rootElement)
    }

    private addStyles() {
        if (this.styled) return
    
        const style = document.createElement('style')
        style.textContent = scss
        this.shadowRootElement.appendChild(style)
    
        this.styled = true
    }

    private addDOM() {
        if (this.rootElement) return
    
        const div = document.createElement('div')
        div.classList.add('element')

        div.addEventListener('input', () => {
            const context = this.selection?.resolveInlineContext()
            if (!context) return

            const effect = this.editor?.resolveInput(context)
            if (effect) this.editor?.apply(effect)
        })

        div.addEventListener('keydown', (event: KeyboardEvent) => {
            const intent = onKey[event.key]
            if (!intent) return

            const context = this.selection?.resolveInlineContext()
            if (!context) return
            
            const effect = this.editor?.onIntent(intent, context)
            if (effect) {
                this.editor?.apply(effect)

                if (effect.preventDefault) {
                    event.preventDefault()
                }
            }
        })

        this.shadowRootElement.appendChild(div)
        this.rootElement = div
    }

    private emitChange() {
        this.dispatchEvent(new Event('change', {
            bubbles: true,
            composed: true,
        }))
    }
}

export default Element
