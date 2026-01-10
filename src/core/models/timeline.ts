import Editor from './editor'
import { Event } from '../types'

class Timeline {
    private undoStack: Event[] = []
    private redoStack: Event[] = []
    private currentEvent: Event

    constructor(private editor: Editor, initialEvent: Event) {
        this.currentEvent = initialEvent
    }

    public push(event: Event): void {
        this.undoStack.push(event)
        this.redoStack = []
        this.currentEvent = event

        console.log('push', JSON.stringify(event, null, 2), JSON.stringify(this.undoStack, null, 2))
    }

    public undo(): void {
        const event = this.undoStack.pop()
        if (!event) return
        this.redoStack.push(this.currentEvent)
        this.currentEvent = event
        this.restore(event)
    }

    public redo(): void {
        const event = this.redoStack.pop()
        if (!event) return
        this.undoStack.push(this.currentEvent)
        this.currentEvent = event
        this.restore(event)
    }

    private restore(event: Event): void {
        // this.editor.ast.setText(event.text)
        // this.editor.caret = event.caret
        // this.editor.render.render(event.blocks)
    }
}

export default Timeline
