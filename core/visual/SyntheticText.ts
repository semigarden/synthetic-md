import Engine from '../engine/engine'
import Caret from './caret'
import { renderAST } from '../render/render'
import css from './SyntheticText.scss?inline'

export class SyntheticText extends HTMLElement {
    private root: ShadowRoot
    private styled = false
    private syntheticEl?: HTMLDivElement
    private engine = new Engine()
    private caret = new Caret()
    private connected = false
    private isRendered = false
    private isEditing = false

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
          this.isRendered = true
        }
    }

    get value() {
        return this.engine.getText()
    }

    private render() {
        if (!this.syntheticEl) return
        const ast = this.engine.getAst()
        if (!ast) return

        renderAST(ast, this.syntheticEl)
    }

    private addStyles() {
        if (this.styled) return
    
        const style = document.createElement('style')
        style.textContent = css
        this.root.appendChild(style)
    
        this.styled = true
    }

    private addDOM() {
        if (this.syntheticEl) return
    
        const div = document.createElement('div')
        div.classList.add('syntheticText')

        document.addEventListener('selectionchange', () => {
            if (!this.syntheticEl) return;
        
            const selection = window.getSelection();
            if (!selection?.rangeCount) return;
          
            const range = selection.getRangeAt(0);
            const container = range.commonAncestorContainer;
          
            let inlineEl: HTMLElement | null = null;
          
            if (container instanceof HTMLElement) {
              inlineEl = container.closest('[data-inline-id]') ?? null;
            } else if (container instanceof Text) {
              inlineEl = container.parentElement?.closest('[data-inline-id]') ?? null;
            }
          
            if (!inlineEl || !this.syntheticEl?.contains(inlineEl)) {
              this.caret.clear();
              return;
            }
          
            const inlineId = inlineEl.dataset.inlineId!;
            const inline = this.engine.getInlineById(inlineId);
            if (!inline) return;
          
            this.caret.setInlineId(inlineId);
            this.caret.setBlockId(inline.blockId);
          
            const preRange = range.cloneRange();
            preRange.selectNodeContents(inlineEl);
            preRange.setEnd(range.startContainer, range.startOffset);
            const position = preRange.toString().length;
          
            this.caret.setPosition(position);
          
            console.log('Caret moved to:', inlineId, 'position:', position);
        });

        div.addEventListener('focusin', (e: FocusEvent) => {
            console.log('focusin')
            const target = e.target as HTMLElement
            if (!target.dataset?.inlineId) return;

            const inlineId = target.dataset.inlineId!;
            console.log('focusin on inline:', inlineId);

            const inline = this.engine.getInlineById(inlineId);
            if (!inline) return;

            this.isEditing = true;
            this.caret.setInlineId(inlineId);
            this.caret.setBlockId(inline.blockId);

            const selection = window.getSelection();
            if (!selection || selection.rangeCount === 0) return;

            const range = selection.getRangeAt(0);

            if (range.commonAncestorContainer.parentElement?.closest('[data-inline-id]') === target ||
                range.commonAncestorContainer === target) {

                let position: number;

                if (range.startContainer === target) {
                    position = range.startOffset;
                } else {
                    const textNode = range.startContainer as Text;
                    const preCaretRange = range.cloneRange();
                    preCaretRange.selectNodeContents(target);
                    preCaretRange.setEnd(range.startContainer, range.startOffset);
                    position = preCaretRange.toString().length;
                }

                this.caret.setPosition(position);
                console.log('caret position:', position, 'in text:', target.textContent);
            }
        })

        div.addEventListener('focusout', (e) => {
            console.log('focusout')
            if (!this.syntheticEl?.contains(e.relatedTarget as Node)) {
                this.isEditing = false;
                this.caret.clear();
            }
        })
  
        div.addEventListener('input', () => {
            const text = div.textContent ?? ''
            
            this.onInput(text)

            this.dispatchEvent(new CustomEvent('change', {
                detail: { value: text },
                bubbles: true,
                composed: true,
            }))
        })
    
        this.root.appendChild(div)
        this.syntheticEl = div
    }

    private onInput(text: string) {
        console.log('onInput', text)
    }
}
