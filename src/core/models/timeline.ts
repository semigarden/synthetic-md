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
        // this.editor.ast = clone(event.blocks)
        // this.editor.caret = event.caret
        // this.editor.render()
    }
}

export default Timeline
