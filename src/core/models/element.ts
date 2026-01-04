import AST from './ast'
import Caret from './caret'
import Editor from './editor'
import scss from '../styles/element.scss?inline'
import { buildAst } from '../ast/ast'
import { renderAST } from '../render/render'
import { onKey, Intent } from '../utils/key'

class Element extends HTMLElement {
    private root: ShadowRoot
    private styled = false
    private syntheticEl?: HTMLElement
    private ast = new AST()
    private caret: Caret | null = null
    private focusedInlineId: string | null = null
    private hasAcceptedExternalValue = false
    private editor: Editor | null = null

    constructor() {
        super()
        this.root = this.attachShadow({ mode: 'open' })
    }

    connectedCallback() {
        const attrValue = this.getAttribute('value') ?? ''

        this.ast.setText(attrValue)
        this.ast.ast = buildAst(attrValue)

        this.addStyles()
        this.addDOM()
        this.render()

        this.caret = new Caret(this.syntheticEl!)
        this.editor = new Editor(this.ast, this.caret, this.syntheticEl!, this.emitChange.bind(this))
    }

    set value(value: string) {
        if (value === this.ast.getText()) return

        if (!this.hasAcceptedExternalValue && value !== '') {
            this.ast.setText(value)
            this.ast.ast = buildAst(value)
            this.render()
            this.hasAcceptedExternalValue = true
        }
    }

    get value() {
        return this.ast.getText()
    }

    private render() {
        if (!this.syntheticEl) return
        const ast = this.ast.getAst()
        if (!ast) return

        renderAST(ast, this.syntheticEl)
    }

    private addStyles() {
        if (this.styled) return
    
        const style = document.createElement('style')
        style.textContent = scss
        this.root.appendChild(style)
    
        this.styled = true
    }

    private addDOM() {
        if (this.syntheticEl) return
    
        const div = document.createElement('div')
        div.classList.add('element')

        document.addEventListener('selectionchange', () => {
            // console.log('selectionchange')
            if (!this.syntheticEl) return;
        
            requestAnimationFrame(() => {
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
                this.caret?.clear();
                return;
                }
            
                const inlineId = inlineEl.dataset.inlineId!;
                const inline = this.ast.getInlineById(inlineId);
                if (!inline) return;

                const block = this.ast.getBlockById(inline.blockId);
                if (!block) return;

                this.caret?.setInlineId(inlineId);
                this.caret?.setBlockId(inline.blockId);
            
                const preRange = range.cloneRange();
                preRange.selectNodeContents(inlineEl);
                preRange.setEnd(range.startContainer, range.startOffset);
                let position = preRange.toString().length + inline.position.start + block.position.start;
            
                this.caret?.setPosition(position);
            
                // console.log('Caret moved to:', inlineId, 'position:', position);
            })
        });

        div.addEventListener('focusin', (e: FocusEvent) => {
            const target = e.target as HTMLElement;
            if (!target.dataset?.inlineId) return;
          
            const inline = this.ast.getInlineById(target.dataset.inlineId!);
            if (!inline) return;

            const selection = window.getSelection();
            if (!selection || selection.rangeCount === 0) return;

            const range = selection.getRangeAt(0);

            let syntheticOffset = 0;
            if (target.contains(range.startContainer)) {
                const preRange = document.createRange();
                preRange.selectNodeContents(target);
                preRange.setEnd(range.startContainer, range.startOffset);
                syntheticOffset = preRange.toString().length;
            }

            const syntheticVisibleLength = target.textContent?.length ?? 1;

            target.innerHTML = '';
            const newTextNode = document.createTextNode(inline.text.symbolic);
            target.appendChild(newTextNode);

            const symbolicOffset = this.mapSyntheticOffsetToSymbolic(
                syntheticVisibleLength,
                inline.text.symbolic.length,
                syntheticOffset
            );

            const clampedOffset = Math.max(0, Math.min(symbolicOffset, inline.text.symbolic.length));
            const newRange = document.createRange();
            newRange.setStart(newTextNode, clampedOffset);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);

            this.focusedInlineId = inline.id;
        });

        div.addEventListener('focusout', (e) => {
            if (this.focusedInlineId !== null) {
                const inlineEl = this.syntheticEl?.querySelector(`[data-inline-id="${this.focusedInlineId}"]`) as HTMLElement;
                if (!inlineEl) return;

                const inline = this.ast.getInlineById(this.focusedInlineId);
                if (inline) {
                    inlineEl.innerHTML = '';
                    const newTextNode = document.createTextNode(inline.text.semantic);
                    inlineEl.appendChild(newTextNode);
                }
            }

            // console.log('focusout')
            if (!this.syntheticEl?.contains(e.relatedTarget as Node)) {
                const target = e.target as HTMLElement
                if (!target.dataset?.inlineId) return;

                const inlineId = target.dataset.inlineId!;
                const inline = this.ast.getInlineById(inlineId);
                if (!inline) return;

                target.innerHTML = '';
                const newTextNode = document.createTextNode(inline.text.semantic);
                target.appendChild(newTextNode);

                this.caret?.clear();
                this.focusedInlineId = null;
            }
        })

        div.addEventListener('input', (e: Event) => {
            this.editor?.onInput(e)
        })

        div.addEventListener('keydown', (event: KeyboardEvent) => {
            const intent = onKey[event.key]
            if (!intent) return

            event.preventDefault()
            this.editor?.onIntent(intent, event)
        })

        div.addEventListener('click', (e: MouseEvent) => {
            const target = e.target as HTMLElement
            if (target.dataset?.inlineId) {
                // console.log('click on inline', target.dataset.inlineId)
            }
            if (target.dataset?.blockId) {
                // console.log('click on block', target.dataset.blockId)
                const block = this.ast.getBlockById(target.dataset.blockId)
                if (block) {
                    const lastInline = block.inlines.at(-1)
                    if (lastInline) {
                        this.caret?.setInlineId(lastInline.id)
                        this.caret?.setBlockId(block.id)
                        this.caret?.setPosition(lastInline.text.symbolic.length)
                        this.caret?.restoreCaret()
                    }
                }
            }
            if (target.classList.contains('element')) {
                // console.log('click on syntheticText')
                const lastBlock = this.ast.ast.blocks.at(-1)
                if (lastBlock) {
                    const lastInline = lastBlock.inlines.at(-1)
                    if (lastInline) {
                        this.caret?.setInlineId(lastInline.id)
                        this.caret?.setBlockId(lastBlock.id)
                        this.caret?.setPosition(lastInline.text.symbolic.length)
                        this.caret?.restoreCaret()
                    }
                }
            }
        })
    
        this.root.appendChild(div)
        this.syntheticEl = div
    }

    private emitChange() {
        this.dispatchEvent(new Event('change', {
            bubbles: true,
            composed: true,
        }))
    }

    private mapSyntheticOffsetToSymbolic(
        syntheticLength: number,
        symbolicLength: number,
        syntheticOffset: number
    ) {
        if (syntheticOffset === 0) return 0;
        let ratio = symbolicLength / syntheticLength;
        ratio = Math.max(0.5, Math.min(2.0, ratio));
        let offset = Math.round(syntheticOffset * ratio);

        return Math.max(0, Math.min(offset, symbolicLength));
    }
}

export default Element
