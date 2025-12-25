import React, { useRef, useLayoutEffect, useCallback, useState, useEffect } from "react"
import styles from "../styles/SyntheticText.module.scss"

type TextBuffer = {
    text: string
    selection: {
        start: number,
        end: number,
    }
}

interface Block {
    type: "document" | "paragraph" | "heading" | "block-quote" | "list" | "list-item" | "code-block" | "thematic-break" | "html-block" | "line-break"
    text: string
    start: number
    end: number
}

const Synthetic: React.FC<{
    className?: string
    value?: string
    onChange?: (e: React.ChangeEvent<HTMLDivElement>) => void
  }> = ({ className = "", value = "", onChange }) => {
    const [, forceRender] = useState(0)
    
    const activeRef = useRef<HTMLDivElement | null>(null)
    const lastActiveStartRef = useRef<number | null>(null)
    const lastActiveIndexRef = useRef<number | null>(null)
    const lastCommittedTextRef = useRef<string | null>(null)
  
    const bufferRef = useRef<TextBuffer>({
      text: value,
      selection: { start: 0, end: 0 },
    })

    if (bufferRef.current.text !== value) {
      bufferRef.current.text = value
    }


    const blocks = parseBlocks(bufferRef.current.text)


    const activeIndex = findActiveBlock(
      blocks,
      bufferRef.current.selection.start
    )
  
    const activeBlock = blocks[activeIndex]
  
    useEffect(() => {
      if (lastActiveIndexRef.current !== activeIndex) {
        lastActiveIndexRef.current = activeIndex
        forceRender(x => x + 1)
      }
    }, [activeIndex])

    useLayoutEffect(() => {
        if (!activeRef.current || !activeBlock) return
      
        const el = activeRef.current
      
        if (lastActiveStartRef.current !== activeBlock.start) {
          el.textContent = activeBlock.text
          lastCommittedTextRef.current = activeBlock.text
          lastActiveStartRef.current = activeBlock.start
          
          const range = document.createRange()
          range.selectNodeContents(el)
          range.collapse(true)
          const sel = window.getSelection()
          sel?.removeAllRanges()
          sel?.addRange(range)
        }
        
        const localStart = bufferRef.current.selection.start - activeBlock.start
        const localEnd = bufferRef.current.selection.end - activeBlock.start
        
        if (localStart >= 0 && localStart <= activeBlock.text.length) {
          restoreSelection(el, localStart, localEnd)
        }
      }, [activeBlock?.start, bufferRef.current.text])
  
      const onBlockInput = useCallback((e: React.FormEvent<HTMLDivElement>) => {
        if (!activeRef.current || !activeBlock) return;
      
        const newText = activeRef.current.textContent ?? "";
      
        const { start: localStart, end: localEnd } = readSelection(activeRef.current);
      
        const globalStart = activeBlock.start + localStart;
        const globalEnd = activeBlock.start + localEnd;
      
        const before = bufferRef.current.text.slice(0, activeBlock.start);
        const after = bufferRef.current.text.slice(activeBlock.end);
        bufferRef.current.text = before + newText + after;
      
        bufferRef.current.selection = {
          start: globalStart,
          end: globalEnd,
        };
      
        lastCommittedTextRef.current = newText;
      
        onChange?.({
          ...e,
          target: { ...e.currentTarget, value: bufferRef.current.text },
          currentTarget: { ...e.currentTarget, value: bufferRef.current.text },
        } as React.ChangeEvent<HTMLDivElement>);
      
        forceRender(x => x + 1);
      }, [activeBlock, onChange]);

      const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key !== "Enter" || !activeRef.current || !activeBlock) return;
      
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return;
      
        const range = sel.getRangeAt(0);
        if (!activeRef.current.contains(range.startContainer)) return;
      
        e.preventDefault();
      
        const preRange = document.createRange();
        preRange.setStart(activeRef.current, 0);
        preRange.setEnd(range.startContainer, range.startOffset);
        const localCursor = preRange.toString().length;
      
        const currentText = activeRef.current.textContent ?? "";
        const beforeText = currentText.slice(0, localCursor);
        const afterText = currentText.slice(localCursor);
      
        const beforeBlock = bufferRef.current.text.slice(0, activeBlock.start);
        const afterBlock = bufferRef.current.text.slice(activeBlock.end);
        const newFullText = beforeBlock + beforeText + "\n" + afterText + afterBlock;
      
        bufferRef.current.text = newFullText;
      
        const newCursorPos = activeBlock.start + beforeText.length + 1; // +1 for \n
        bufferRef.current.selection = { start: newCursorPos, end: newCursorPos };
      
        onChange?.({
          ...e,
          target: { value: newFullText } as any,
          currentTarget: { value: newFullText } as any,
        } as React.ChangeEvent<HTMLDivElement>);
      
        forceRender(x => x + 1);
      }, [activeBlock, onChange]);
  
    return (
      <div 
        className={`${styles.syntheticText} ${className}`} 
        style={{ fontFamily: "monospace" }}
      >
        {blocks.map((block, i) => {
          if (i === activeIndex) {
            return (
              <div
                key={block.start}
                ref={activeRef}
                contentEditable
                suppressContentEditableWarning
                onInput={onBlockInput}
                onKeyDown={onKeyDown}
                style={{ whiteSpace: "pre-wrap", outline: "none" }}
                data-start={block.start}
                data-end={block.end}
              >
                {block.text}
              </div>
            )
          }
  
          return (
            <div
                key={block.start}
                onMouseDown={(e) => {
                e.preventDefault();

                const target = e.target as HTMLElement;
                if (!(target instanceof HTMLElement)) return;

                const blockEl = target.closest('[data-start]') as HTMLElement;
                if (!blockEl) return;

                const clickX = e.clientX;
                const clickY = e.clientY;

                const localOffset = getCaretCharacterOffset(blockEl, clickX, clickY);

                const clampedOffset = Math.max(0, Math.min(localOffset, block.text.length));

                const globalPos = block.start + clampedOffset;

                bufferRef.current.selection = {
                    start: globalPos,
                    end: globalPos,
                };

                forceRender(x => x + 1);
                }}
                data-start={block.start}
                data-end={block.end}
            >
                {renderInline(block.text)}
            </div>
          )
        })}
      </div>
    )
  }

export { Synthetic }

function parseBlocks(text: string): Block[] {
    const lines = text.split("\n")
    const blocks: Block[] = []

    let offset = 0
  
    for (const line of lines) {
      const lineStart = offset
      const lineEnd = offset + line.length
  
      let type: Block["type"] = "paragraph"
  
      if (line.startsWith("# ")) {
        type = "heading"
      } else if (line.startsWith("> ")) {
        type = "block-quote"
      } else if (line.startsWith("- ")) {
        type = "list-item"
      } else if (line.trim() === "") {
        type = "line-break"
      }
  
      blocks.push({
        type,
        text: line,
        start: lineStart,
        end: lineEnd,
      })
  
      offset = lineEnd + 1
    }
  
    return blocks
  }

  function findActiveBlock(
    blocks: Block[],
    cursor: number
  ): number {
    return blocks.findIndex(
      b => cursor >= b.start && cursor <= b.end
    )
  }

  function renderInline(text: string): React.ReactNode[] {
    const result: React.ReactNode[] = []
    let i = 0
  
    while (i < text.length) {
      if (text[i] === "*" && text[i + 1] === "*") {
        const end = text.indexOf("**", i + 2)
        if (end !== -1) {
          result.push(
            <strong key={i}>
              {text.slice(i + 2, end)}
            </strong>
          )
          i = end + 2
          continue
        }
      }
  
      result.push(text[i])
      i++
    }
  
    return result
  }

  function getCaretCharacterOffset(element: HTMLElement, clientX: number, clientY: number): number {
    let offset = 0;
  
    if (typeof document.caretRangeFromPoint === "function") {
      const range = document.caretRangeFromPoint(clientX, clientY);
      if (range && element.contains(range.startContainer)) {
        const preCaretRange = document.createRange();
        preCaretRange.setStart(element, 0);
        preCaretRange.setEnd(range.startContainer, range.startOffset);
        offset = preCaretRange.toString().length;
        return offset;
      }
    }
  
    if ((document as any).caretPositionFromPoint) {
      const pos = (document as any).caretPositionFromPoint(clientX, clientY);
      if (pos && element.contains(pos.offsetNode)) {
        const preCaretRange = document.createRange();
        preCaretRange.setStart(element, 0);
        preCaretRange.setEnd(pos.offsetNode, pos.offset);
        offset = preCaretRange.toString().length;
        return offset;
      }
    }
  
    return element.textContent?.length ?? 0;
  }
  

function readSelection(root: HTMLElement): { start: number; end: number } {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) {
      return { start: 0, end: 0 }
    }
  
    const range = sel.getRangeAt(0)
  
    const preStart = range.cloneRange()
    preStart.selectNodeContents(root)
    preStart.setEnd(range.startContainer, range.startOffset)
  
    const start = preStart.toString().length
    const end = start + range.toString().length
  
    return { start, end }
  }
  
function restoreSelection(
    root: HTMLElement,
    start: number,
    end: number
) {
    const range = document.createRange()
    const sel = window.getSelection()
    if (!sel) return
  
    let charIndex = 0
    let startNode: Node | null = null
    let startOffset = 0
    let endNode: Node | null = null
    let endOffset = 0
  
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  
    while (walker.nextNode()) {
      const node = walker.currentNode as Text
      const nextCharIndex = charIndex + node.length
  
      if (!startNode && start <= nextCharIndex) {
        startNode = node
        startOffset = start - charIndex
      }
  
      if (!endNode && end <= nextCharIndex) {
        endNode = node
        endOffset = end - charIndex
        break
      }
  
      charIndex = nextCharIndex
    }
  
    if (!startNode || !endNode) return
  
    range.setStart(startNode, startOffset)
    range.setEnd(endNode, endOffset)
  
    sel.removeAllRanges()
    sel.addRange(range)
}
  