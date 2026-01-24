import Editor from './editor'
import { TimelineEvent, Block, Caret } from '../types'

class Timeline {
    private undoStack: TimelineEvent[] = []
    private redoStack: TimelineEvent[] = []
    private currentEvent: TimelineEvent

    constructor(private editor: Editor, initialEvent: TimelineEvent) {
        this.currentEvent = this.cloneEvent(initialEvent)
    }

    public push(event: TimelineEvent): void {
        const clonedEvent = this.cloneEvent(event)
        this.undoStack.push(clonedEvent)
        this.redoStack = []
    }

    public updateEvent(event: TimelineEvent): void {
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

    private restore(event: TimelineEvent): void {
        const clonedBlocks = this.cloneBlocks(event.blocks)

        this.editor.ast.text = event.text
        this.editor.ast.blocks = clonedBlocks
        this.editor.render.renderBlocks(clonedBlocks)
        this.editor.caret.restoreCaret(event.caret.inlineId, event.caret.position)
        this.editor.emitChange()
    }

    private cloneEvent(event: TimelineEvent): TimelineEvent {
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
