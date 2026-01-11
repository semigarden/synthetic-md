import Ast from './ast/ast'
import Caret from './caret'
import Selection from './selection'
import Interaction from './interaction'
import Editor from './editor'
import Render from './render'
import Input from './input'
import Intent from './intent'
import scss from '../styles/element.scss?inline'

class Element extends HTMLElement {
    private shadowRootElement: ShadowRoot
    private rootElement?: HTMLElement
    private ast = new Ast()
    private render: Render | null = null
    private caret: Caret | null = null
    private selection: Selection | null = null
    private interaction: Interaction | null = null
    private editor: Editor | null = null

    private input: Input | null = null
    private intent: Intent | null = null
    
    private styled = false
    private hasAcceptedExternalValue = false

    constructor() {
        super()
        this.shadowRootElement = this.attachShadow({ mode: 'open' })
    }

    connectedCallback() {
        const attrValue = this.getAttribute('value') ?? ''

        this.ast.setText(attrValue)

        this.addStyles()
        this.addDOM()

        this.render = new Render(this.rootElement!)
        this.caret = new Caret(this.rootElement!)
        this.editor = new Editor(this.ast, this.caret, this.render, this.emitChange.bind(this))
        this.selection = new Selection(this.ast, this.caret, this.rootElement!)
        this.selection.attach()

        this.input = new Input(this.ast, this.caret, this.selection)
        this.intent = new Intent(this.ast, this.caret, this.selection, this.render)

        this.interaction = new Interaction(this.rootElement!, this.selection, this.editor, this.input, this.intent)
        this.interaction.attach()

        this.renderAST()
    }

    disconnectedCallback() {
        this.interaction?.detach()
        this.selection?.detach()
        this.caret?.clear()
    }

    set value(value: string) {
        if (value === this.ast.text) return

        if (!this.hasAcceptedExternalValue && value !== '') {
            this.ast.setText(value)
            this.renderAST()
            this.hasAcceptedExternalValue = true
        }
    }

    get value() {
        return this.ast.text
    }

    private renderAST() {
        if (!this.rootElement) return
        if (!this.render) return

        this.render.render(this.ast.blocks, this.rootElement)
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
        div.contentEditable = 'true'

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
