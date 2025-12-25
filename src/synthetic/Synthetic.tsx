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
    const desiredXRef = useRef<number | null>(null);
  
    const bufferRef = useRef<TextBuffer>({
      text: value,
      selection: { start: 0, end: 0 },
    })

    if (bufferRef.current.text !== value) {
      bufferRef.current.text = value
    }


    // const blocks = parseBlocks(bufferRef.current.text)
    const blocks = parseBlocks(bufferRef.current.text);
    const activeIndex = findActiveBlock(blocks, bufferRef.current.selection.start);
  


    // const activeIndex = findActiveBlock(
    //   blocks,
    //   bufferRef.current.selection.start
    // )
  
    const activeBlock = blocks[activeIndex]
  
    useEffect(() => {
      if (lastActiveIndexRef.current !== activeIndex) {
        lastActiveIndexRef.current = activeIndex
        forceRender(x => x + 1)
      }
    }, [activeIndex])

    useLayoutEffect(() => {
        if (!activeRef.current || !activeBlock) return;
        const el = activeRef.current;
      
        if (lastActiveStartRef.current !== activeBlock.start) {
          el.textContent = activeBlock.text;
          lastCommittedTextRef.current = activeBlock.text;
          lastActiveStartRef.current = activeBlock.start;
        }
      
        const localStart = bufferRef.current.selection.start - activeBlock.start;
        const localEnd = bufferRef.current.selection.end - activeBlock.start;
      
        const maxLength = activeBlock.text.length;
        const clampedStart = Math.max(0, Math.min(localStart, maxLength));
        const clampedEnd = Math.max(clampedStart, Math.min(localEnd, maxLength));
      
        restoreSelection(el, clampedStart, clampedEnd);
      }, [activeBlock?.start, bufferRef.current.text]);
  
      const onBlockInput = useCallback((e: React.FormEvent<HTMLDivElement>) => {
        if (!activeRef.current || !activeBlock) return;
      
        const newText = activeRef.current.textContent ?? "";
        const { start: localStart, end: localEnd } = readSelection(activeRef.current);

        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
            const cursorRange = sel.getRangeAt(0).cloneRange();
            if (localStart === localEnd && cursorRange.startContainer.nodeType === Node.TEXT_NODE) {
            cursorRange.collapse(true);
            const rects = cursorRange.getClientRects();
            if (rects.length > 0) {
                desiredXRef.current = rects[0].left;
            }
            }
        }
  
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
        if (!activeRef.current || !activeBlock) return;
      
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;
      
        const range = sel.getRangeAt(0);
      
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            const isUp = e.key === "ArrowUp";
          
            const currentRange = range.cloneRange();
            currentRange.collapse(true);
            const rects = currentRange.getClientRects();
            if (rects.length > 0) {
              desiredXRef.current = rects[0].left;
            }
          
            const localSel = readSelection(activeRef.current!);
            const atTop = isUp && localSel.start === 0;
            const atBottom = !isUp && localSel.end === (activeRef.current!.textContent?.length ?? 0);
          
            if ((isUp && atTop) || (!isUp && atBottom)) {
              e.preventDefault();
          
              const targetIndex = isUp ? activeIndex - 1 : activeIndex + 1;
              if (targetIndex >= 0 && targetIndex < blocks.length) {
                const targetBlock = blocks[targetIndex];
          
                let targetLocalOffset = 0;
                if (desiredXRef.current !== null && activeRef.current) {
                  targetLocalOffset = getOffsetAtX(activeRef.current, desiredXRef.current);
                  targetLocalOffset = Math.max(0, Math.min(targetLocalOffset, targetBlock.text.length));
                } else {
                  targetLocalOffset = isUp ? targetBlock.text.length : 0;
                }
          
                const globalPos = targetBlock.start + targetLocalOffset;
          
                bufferRef.current.selection = { start: globalPos, end: globalPos };
                forceRender(x => x + 1);
              }
            }
            return;
          }
      
        if (e.key === "Enter") {
          if (!sel.isCollapsed) return;
      
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
      
          const newCursorPos = activeBlock.start + beforeText.length + 1;
          bufferRef.current.selection = { start: newCursorPos, end: newCursorPos };
      
          onChange?.({
            ...e,
            target: { value: newFullText } as any,
            currentTarget: { value: newFullText } as any,
          } as React.ChangeEvent<HTMLDivElement>);
      
          forceRender(x => x + 1);
        }
      }, [activeBlock, activeIndex, blocks, onChange]);

    
  const handleBlockClick = useCallback((index: number, clickX: number, clickY: number) => {
    const block = blocks[index];
    const localOffset = getCaretCharacterOffset(
      // We'll use a temporary range or estimate
      // But for simplicity, default to end or use desiredXRef
      document.querySelector(`[data-block-index="${index}"]`) as HTMLElement,
      clickX,
      clickY
    );
    const globalPos = block.start + Math.max(0, Math.min(localOffset, block.text.length));
    bufferRef.current.selection = { start: globalPos, end: globalPos };
    desiredXRef.current = clickX;
    forceRender(x => x + 1);
  }, [blocks]);
  
  return (
    <div className={`${styles.syntheticText} ${className}`} style={{ fontFamily: "inherit" }}>
      {blocks.map((block, i) => {
        const isActive = i === activeIndex;

        if (isActive) {
          return (
            <div
              key={block.start}
              ref={activeRef}
              contentEditable
              suppressContentEditableWarning
              onInput={onBlockInput}
              onKeyDown={onKeyDown}
              style={{
                whiteSpace: "pre-wrap",
                outline: "none",
                wordBreak: "break-word",
                padding: "2px 0",
                background: "rgba(255,255,0,0.1)", // optional: subtle highlight when editing
              }}
              data-block-index={i}
            >
              {block.text /* ← Raw markdown shown only here */}
            </div>
          );
        }

        // Inactive block → fully rendered (Obsidian style)
        return (
          <div
            key={block.start}
            onMouseDown={(e) => {
              // Only activate on left click, not selection
              if (e.button === 0) {
                e.preventDefault();
                const el = e.currentTarget;
                const rect = el.getBoundingClientRect();
                handleBlockClick(i, e.clientX, rect.top + rect.height / 2);
              }
            }}
            style={{
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              padding: "2px 0",
              cursor: "text",
            }}
            data-block-index={i}
          >
            {renderBlock(block)}
          </div>
        );
      })}
    </div>
  )
  }

export { Synthetic }

function renderBlock(block: Block): React.ReactNode {
    const content = renderInline(block.text); // your existing bold, etc.
  
    switch (block.type) {
      case "heading":
        const level = block.text.match(/^#+/)?.[0].length || 1;
        return React.createElement(`h${Math.min(level, 6)}`, { key: block.start }, content);
  
      case "block-quote":
        return (
          <blockquote style={{ borderLeft: "4px solid #ddd", paddingLeft: "16px", margin: "8px 0", opacity: 0.8 }}>
            {content}
          </blockquote>
        );
  
      case "list-item":
        return (
          <div style={{ display: "flex", alignItems: "flex-start" }}>
            <span style={{ marginRight: "8px", flexShrink: 0 }}>•</span>
            <div style={{ flex: 1 }}>{content}</div>
          </div>
        );
  
      case "code-block":
        return (
          <pre style={{ background: "#f6f8fa", padding: "12px", borderRadius: "6px", fontFamily: "monospace" }}>
            <code>{block.text}</code>
          </pre>
        );
  
      case "thematic-break":
        return <hr style={{ border: "none", borderTop: "1px solid #ddd", margin: "16px 0" }} />;
  
      default:
        return <p style={{ margin: "8px 0" }}>{content}</p>;
    }
  }

//   function renderInline(text: string): React.ReactNode[] {
//     const parts = text.split(/(\*\*[\s\S]*?\*\*|\*[\s\S]*?\*|`[^`]*`)/g);
//     const result: React.ReactNode[] = [];
//     let key = 0;
  
//     for (const part of parts) {
//       if (!part) continue;
  
//       if (part.startsWith("**") && part.endsWith("**")) {
//         result.push(<strong key={key++}>{part.slice(2, -2)}</strong>);
//       } else if (part.startsWith("*") && part.endsWith("*")) {
//         result.push(<em key={key++}>{part.slice(1, -1)}</em>);
//       } else if (part.startsWith("`") && part.endsWith("`")) {
//         result.push(<code key={key++} style={{ background: "#f0f0f0", padding: "2px 4px", borderRadius: "3px" }}>{part.slice(1, -1)}</code>);
//       } else {
//         // Split by newlines? Or just push text
//         result.push(part);
//       }
//     }
  
//     return result;
//   }

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
  
  function getOffsetAtX(element: HTMLElement, x: number): number {
    let bestOffset = 0;
    let bestDistance = Infinity;
  
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let offset = 0;
  
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      const range = document.createRange();
  
      for (let i = 0; i <= node.length; i++) {
        range.setStart(node, i);
        range.collapse(true);
        const rects = range.getClientRects();
        for (const rect of rects) {
          const dist = Math.abs(rect.left - x);
          if (dist < bestDistance) {
            bestDistance = dist;
            bestOffset = offset + i;
          }
        }
      }
      offset += node.length;
    }
  
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    const rects = range.getClientRects();
    for (const rect of rects) {
      const dist = Math.abs(rect.right - x);
      if (dist < bestDistance) {
        bestDistance = dist;
        bestOffset = element.textContent?.length ?? 0;
      }
    }
  
    return bestOffset;
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
  