import Input from './input'
import Intent from './intent'
import Editor from './editor'
import Select from './select/select'
import { Intent as IntentType } from '../types'

class Interaction {
    constructor(
        private rootElement: HTMLElement,
        private select: Select,
        private editor: Editor,
        private input: Input,
        private intent: Intent,
    ) {}

    attach() {
        this.rootElement.addEventListener('beforeinput', this.onBeforeInput)
        this.rootElement.addEventListener('keydown', this.onKeyDown)
        this.rootElement.addEventListener('paste', this.onPaste)
        this.rootElement.addEventListener('copy', this.onCopy)
        this.rootElement.addEventListener('click', this.onClick)
    }

    detach() {
        this.rootElement.removeEventListener('beforeinput', this.onBeforeInput)
        this.rootElement.removeEventListener('keydown', this.onKeyDown)
        this.rootElement.removeEventListener('paste', this.onPaste)
        this.rootElement.removeEventListener('copy', this.onCopy)
        this.rootElement.removeEventListener('click', this.onClick)
    }

    private onBeforeInput = (event: InputEvent) => {
        if (event.inputType === 'insertFromPaste') {
            event.preventDefault()
            return
        }
        
        const effect = this.input.resolveEffect({ text: event.data ?? '', type: event.inputType })
        if (!effect) return
        if (effect.preventDefault) {
            event.preventDefault()
        }

        this.editor.apply(effect)
    }

    private onPaste = (event: ClipboardEvent) => {
        event.preventDefault()
        const text = event.clipboardData?.getData('text/plain') ?? ''
        if (!text) return

        const effect = this.select.paste(text)
        if (effect) {
            this.editor.apply(effect)
            this.select.clearSelection()
        }
    }

    private onCopy = (event: ClipboardEvent) => {
        const text = this.select.getSelectedText()
        if (text) {
            event.clipboardData?.setData('text/plain', text)
            event.preventDefault()
        }
    }

    private onKeyDown = (event: KeyboardEvent) => {
        const intent = this.resolveIntentFromEvent(event)
        if (!intent) return

        if (intent === 'undo') {
            this.editor.undo()
            event.preventDefault()
            return
        }
        
        if (intent === 'redo') {
            this.editor.redo()
            event.preventDefault()
            return
        }

        const context = this.select.resolveInlineContext()
        if (!context) return

        const effect = this.intent.resolveEffect(intent, context)
        if (!effect) return

        if (effect.preventDefault) {
            event.preventDefault()
        }

        this.editor.apply(effect)
    }

    private onClick = (event: MouseEvent) => {
        const target = event.target as HTMLElement | null
        if (!target) return

        const checkbox = target.closest('.taskCheckbox') as HTMLInputElement | null
        if (checkbox) {
            event.preventDefault()

            const blockEl = checkbox.closest('[data-block-id]') as HTMLElement | null
            if (!blockEl) return

            requestAnimationFrame(() => {
                const blockId = blockEl.dataset.blockId
                if (!blockId) return

                const context = this.select.resolveTaskContext(blockId)
                if (!context) return

                const effect = this.intent.resolveEffect('toggleTask', context)
                if (!effect) return

                this.editor.apply(effect)
            })

            return
        }

        const anchor = target.closest('a') as HTMLAnchorElement | null
        if (!anchor) return

        const follow = event.ctrlKey || event.metaKey
    
        if (!follow) {
            event.preventDefault()
            return
        }
    
        event.preventDefault()
        window.open(anchor.href, '_blank', 'noopener,noreferrer')
    }

    private resolveIntentFromEvent = (event: KeyboardEvent): IntentType | null => {
        const key = event.key.toLowerCase()
        if (event.ctrlKey) {
            if (key === 'z') return event.shiftKey ? 'redo' : 'undo'
        }

        if (event.shiftKey) {
            if (key === 'tab') return 'outdent'
            if (key === 'enter') return 'splitInCell'
            if (key === 'backspace') return 'insertRowAbove'
        }

        const context = this.select.resolveInlineContext()
        const isInCodeBlock = context?.block?.type === 'codeBlock'

        if (isInCodeBlock) {
            if (event.ctrlKey && key === 'enter') {
                return 'exitCodeBlockBelow'
            }
            if (key === 'escape' || (event.ctrlKey && event.shiftKey && key === 'enter')) {
                return 'exitCodeBlockAbove'
            }
        }

        switch (key) {
            case 'tab': return 'indent'
            case 'enter': return 'split'
            case 'backspace': return 'merge'
        }
        
        return null
    }
}

export default Interaction
