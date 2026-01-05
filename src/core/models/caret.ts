import { Inline } from "../types"

class Caret {
    private inlineId: string | null = null
    private blockId: string | null = null
    private position: number | null = null
    private affinity?: 'start' | 'end'

    public pendingTextRestore: { blockId: string; offset: number } | null = null

    constructor(
      private rootElement: HTMLElement,
      inlineId?: string,
      blockId?: string,
      position?: number,
      affinity?: 'start' | 'end'
    ) {
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

    public restoreCaret() {
        console.log('restoreCaret', this.getInlineId(), this.getPosition())
        if (!this.getInlineId() || this.getPosition() === null) {
          return;
        }
      
        const inlineId = this.getInlineId()!;
        const position = this.getPosition()!;
      
        const inlineEl = this.rootElement.querySelector(`[data-inline-id="${inlineId}"]`) as HTMLElement;
        if (!inlineEl) {
          console.warn('Could not find inline element for caret restore:', inlineId);
          return;
        }
      
        inlineEl.focus();
      
        const selection = window.getSelection();
        if (!selection) return;
      
        selection.removeAllRanges();
        const range = document.createRange();
      
        try {
          let placed = false;
      
          if (inlineEl.childNodes.length > 0 && inlineEl.firstChild instanceof Text) {
            const textNode = inlineEl.firstChild as Text;
            const clamped = Math.min(position, textNode.length);
            range.setStart(textNode, clamped);
            range.collapse(true);
            placed = true;
          } 
          else if (inlineEl.childNodes.length > 0) {
            let currentPos = 0;
            const walker = document.createTreeWalker(
              inlineEl,
              NodeFilter.SHOW_TEXT,
              null
            );
      
            let node: Text | null;
            while ((node = walker.nextNode() as Text)) {
              const len = node.length;
              if (currentPos + len >= position) {
                range.setStart(node, position - currentPos);
                range.collapse(true);
                placed = true;
                break;
              }
              currentPos += len;
            }
          }
      
          if (!placed) {
            if (inlineEl.childNodes.length > 0) {
              range.selectNodeContents(inlineEl);
              range.collapse(false);
            } else {
              range.setStart(inlineEl, 0);
              range.collapse(true);
            }
          }
      
          selection.addRange(range);
      
          inlineEl.focus();
      
          inlineEl.scrollIntoView({ block: 'nearest' });
      
        } catch (err) {
          console.warn('Failed to restore caret:', err);
          inlineEl.focus();
        }
    }
}

export default Caret
