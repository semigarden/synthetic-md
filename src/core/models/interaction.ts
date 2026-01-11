import Input from './input'
import Intent from './intent'
import Editor from './editor'
import Selection from './selection'
import { Intent as IntentType } from '../types'

class Interaction {
    constructor(
        private rootElement: HTMLElement,
        private selection: Selection,
        private editor: Editor,
        private input: Input,
        private intent: Intent,
    ) {}

    attach() {
        this.rootElement.addEventListener('beforeinput', this.onBeforeInput)
        this.rootElement.addEventListener('keydown', this.onKeyDown)
    }

    detach() {
        this.rootElement.removeEventListener('beforeinput', this.onBeforeInput)
        this.rootElement.removeEventListener('keydown', this.onKeyDown)
    }

    private onBeforeInput = (event: InputEvent) => {
        const effect = this.input.resolveEffect({ text: event.data ?? '', type: event.inputType })
        
        if (!effect) return
        if (effect.preventDefault) {
            event.preventDefault()
        }

        this.editor.apply(effect)
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

        const context = this.selection.resolveInlineContext()
        if (!context) return

        const effect = this.intent.resolveEffect(intent, context)
        if (!effect) return

        if (effect.preventDefault) {
            event.preventDefault()
        }

        this.editor.apply(effect)
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

        switch (key) {
            case 'tab': return 'indent'
            case 'enter': return 'split'
            case 'backspace': return 'merge'
        }
        
        return null
    }
}

export default Interaction
