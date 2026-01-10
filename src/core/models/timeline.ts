import Editor from './editor'
import { Event, Block } from '../types'

class Timeline {
    private undoStack: Event[] = []
    private redoStack: Event[] = []
    private currentEvent: Event

    constructor(private editor: Editor, initialEvent: Event) {
        this.currentEvent = this.cloneEvent(initialEvent)
    }

    public push(event: Event): void {
        const clonedEvent = this.cloneEvent(event)
        this.undoStack.push(clonedEvent)
        this.redoStack = []
        this.currentEvent = clonedEvent

        // console.log('push', JSON.stringify(event, null, 2), JSON.stringify(this.undoStack, null, 2))
    }

    public undo(): void {
        console.log('undo')
        const event = this.undoStack.pop()
        if (!event) return
        this.redoStack.push(this.cloneEvent(this.currentEvent))
        this.currentEvent = event
        this.restore(event)
    }

    public redo(): void {
        console.log('redo')
        const event = this.redoStack.pop()
        if (!event) return
        this.undoStack.push(this.cloneEvent(this.currentEvent))
        this.currentEvent = event
        this.restore(event)
    }

    private restore(event: Event): void {
        console.log('restore', event.text)
        const clonedBlocks = this.cloneBlocks(event.blocks)

        this.editor.ast.text = event.text
        this.editor.ast.blocks = clonedBlocks
        // this.editor.caret = event.caret
        this.editor.render.render(clonedBlocks)
    }

    private cloneEvent(event: Event): Event {
        return {
            text: event.text,
            blocks: this.cloneBlocks(event.blocks),
            caret: { ...event.caret }
        }
    }

    private cloneBlocks(blocks: Block[]): Block[] {
        return JSON.parse(JSON.stringify(blocks))
    }
}

export default Timeline
