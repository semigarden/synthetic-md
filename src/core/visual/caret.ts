import { Inline } from "../ast/types"

export default class Caret {
    private inlineId: string | null = null
    private blockId: string | null = null
    private position: number | null = null
    private affinity?: 'start' | 'end'

    public pendingTextRestore: { blockId: string; offset: number } | null = null

    constructor(inlineId?: string, blockId?: string, position?: number, affinity?: 'start' | 'end') {
        this.inlineId = inlineId ?? null
        this.blockId = blockId ?? null
        this.position = position ?? null
        this.affinity = affinity ?? undefined
    }

    setInlineId(inlineId: string) {
        this.inlineId = inlineId
    }

    setBlockId(blockId: string) {
        this.blockId = blockId
    }

    setPosition(position: number) {
        this.position = position
    }

    setAffinity(affinity?: 'start' | 'end') {
        this.affinity = affinity
    }

    getInlineId() {
        return this.inlineId
    }

    getBlockId() {
        return this.blockId
    }
    
    getPosition() {
        return this.position
    }

    getAffinity() {
        return this.affinity
    }

    clear() {
        this.inlineId = null
        this.blockId = null
        this.position = null
        this.affinity = undefined
    }

    getPositionInInline(inlineEl: HTMLElement) {
        const sel = window.getSelection();
        let caretPositionInInline = 0;
        if (sel && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            const preRange = document.createRange();
            preRange.selectNodeContents(inlineEl);
            preRange.setEnd(range.startContainer, range.startOffset);
            caretPositionInInline = preRange.toString().length;
        }

        return caretPositionInInline
    }

    getPositionInInlines(inlines: Inline[], inlineId: string, caretPositionInInline: number) {
        let charsBeforeEditedInline = 0;
        for (let i = 0; i < inlines.length; i++) {
            if (inlines[i].id === inlineId) break;
            charsBeforeEditedInline += inlines[i].text.symbolic.length;
        }
        
        const caretPositionInInlines = charsBeforeEditedInline + caretPositionInInline;
        return caretPositionInInlines
    }

    getInlineFromPositionInInlines(
        inlines: Inline[],
        positionInInlines: number
    ) {
        let inline: Inline | null = null;
        let position = 0;
        let accumulatedLength = 0;
        
        for (const i of inlines) {
            const textLength = i.text?.symbolic.length ?? 0;
            if (accumulatedLength + textLength >= positionInInlines) {
                inline = i;
                position = positionInInlines - accumulatedLength;
                break;
            }
            accumulatedLength += textLength;
        }

        return {
            inline,
            position
        }
    }
}
