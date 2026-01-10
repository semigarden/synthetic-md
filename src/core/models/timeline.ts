import Editor from './editor'
import { Event, Block, Caret } from '../types'

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
    }

    public updateEvent(event: Event): void {
        this.currentEvent = this.cloneEvent(event)
    }

    public undo(): void {
        const event = this.undoStack.pop()
        if (!event) return
        this.redoStack.push(this.cloneEvent(this.currentEvent))
        this.currentEvent = event
        this.restore(event)
    }

    public redo(): void {
        const event = this.redoStack.pop()
        if (!event) return
        this.undoStack.push(this.cloneEvent(this.currentEvent))
        this.currentEvent = event
        this.restore(event)
    }

    private restore(event: Event): void {
        const clonedBlocks = this.cloneBlocks(event.blocks)

        this.editor.ast.text = event.text
        this.editor.ast.blocks = clonedBlocks
        this.editor.render.render(clonedBlocks)
        this.editor.caret.restoreCaret(event.caret.inlineId, event.caret.position)
        this.editor.emitChange()
    }

    private cloneEvent(event: Event): Event {
        return {
            text: event.text,
            blocks: this.cloneBlocks(event.blocks),
            caret: this.cloneCaret(event.caret),
        }
    }

    private cloneBlocks(blocks: Block[]): Block[] {
        return JSON.parse(JSON.stringify(blocks))
    }

    private cloneCaret(caret: Caret): Caret {
        return {
            blockId: caret.blockId,
            inlineId: caret.inlineId,
            position: caret.position,
            affinity: caret.affinity,
        }
    }
}

export default Timeline
