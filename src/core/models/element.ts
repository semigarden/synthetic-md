import AST from './ast/ast'
import Caret from './caret'
import Selection from './selection'
import Editor from './editor'
import Render from './render'
import scss from '../styles/element.scss?inline'
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

        this.ast.setText(attrValue)

        this.addStyles()
        this.addDOM()

        this.render = new Render(this.rootElement!)
        this.caret = new Caret(this.rootElement!)
        this.editor = new Editor(this.ast, this.caret, this.render, this.emitChange.bind(this))
        this.selection = new Selection(this.ast, this.caret, this.rootElement!)
        this.selection.attach()

        this.renderAST()
    }

    disconnectedCallback() {
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

        // div.addEventListener('input', () => {
        //     console.log('input', div.textContent)
        //     const context = this.selection?.resolveInlineContext()
        //     if (!context) return

        //     const effect = this.editor?.resolveInput(context)
        //     if (effect) this.editor?.apply(effect)
        // })

        div.addEventListener('beforeinput', (e) => {
            const isInsert = e.inputType.startsWith('insert')
            const isDelete = e.inputType.startsWith('delete')
        
            if (!isInsert && !isDelete) return
        
            const range = this.selection?.resolveRange()
            if (!range) return

            const isCollapsed = range.start.blockId === range.end.blockId &&
                range.start.inlineId === range.end.inlineId &&
                range.start.position === range.end.position

            if (isInsert) {
                e.preventDefault()
                this.editor?.applyInsert(range, e.data ?? '')
            } else if (isDelete) {
                if (!isCollapsed) {
                    e.preventDefault()
                    this.editor?.applyInsert(range, '')
                } else {
                    const direction = e.inputType.includes('Backward') ? 'backward' : 'forward'
                    const handled = this.editor?.applyDelete(range, direction)
                    if (handled) {
                        e.preventDefault()
                    }
                }
            }
        })

        div.addEventListener('keydown', (event: KeyboardEvent) => {
            let intent = onKey[event.key]
            
            if (event.key === 'Tab' && event.shiftKey) {
                intent = 'outdent'
            }

            if (event.key === 'Backspace' && event.shiftKey) {
                intent = 'insertRowAbove'
            }

            if (event.key === 'Enter' && event.shiftKey) {
                intent = 'splitInCell'
            }

            const key = event.key.toLowerCase()
            if (key === 'z' && event.ctrlKey && event.shiftKey) {
                this.editor?.timeline.redo()
                return
            }

            if (key === 'z' && event.ctrlKey) {
                this.editor?.timeline.undo()
                return
            }
            
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
