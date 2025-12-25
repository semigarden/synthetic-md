import React, { useRef, useLayoutEffect, useCallback, useState } from "react"
import SyntheticBlock from "./SyntheticBlock"
import styles from "../styles/Synth.module.scss"
import { uuid } from '../utils'

export type InlineType = "text" | "strong" | "em" | "code" | "link" | "image" | "autolink" | "html" | "softbreak" | "hardbreak"

export interface Inline {
    type: InlineType
    synthetic: string
    pure: string
    start: number
    end: number
}

export type BlockType = "paragraph" | "heading" | "block-quote" | "list-item" | "empty";

export interface Block {
    id: string
    type: BlockType
    text: string
    start: number
    end: number
}

const Synth: React.FC<{
  className?: string;
  value?: string;
  onChange?: (value: string) => void;
}> = ({ className = "", value = "", onChange }) => {
    const containerRef = useRef<HTMLDivElement>(null);
  const caretRef = useRef<HTMLSpanElement>(null);

  const [cursor, setCursor] = useState<{ blockId: string; offset: number } | null>(null);

  const blocks = React.useMemo(() => parseBlocks(value), [value]);

  const activeBlock = blocks.find(b => b.id === cursor?.blockId);

  const lastUpdateTimeRef = useRef<number>(0);
  const debounceTimeoutRef = useRef<number | null>(null);
  const justTypedRef = useRef<boolean>(false);

  const updateCursorFromSelection = useCallback(() => {
    const now = Date.now();
    if (now - lastUpdateTimeRef.current < 50) return;

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const anchor = sel.anchorNode;
    if (!anchor || !containerRef.current?.contains(anchor)) return;

    const blockEl = (anchor instanceof Element ? anchor : anchor.parentElement)?.closest("[data-block-id]");
    if (!blockEl) return;

    const blockId = blockEl.getAttribute("data-block-id")!;
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;

    const range = sel.getRangeAt(0).cloneRange();
    range.setStart(blockEl, 0);
    const textBefore = range.toString().length;

    const localOffset = textBefore + sel.anchorOffset;

    if (debounceTimeoutRef.current !== null) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = window.setTimeout(() => {
      setCursor({ blockId, offset: localOffset });
      lastUpdateTimeRef.current = Date.now();
    }, 10);
  }, [blocks]);

  useLayoutEffect(() => {
    document.addEventListener("selectionchange", updateCursorFromSelection);
    return () => document.removeEventListener("selectionchange", updateCursorFromSelection);
  }, [updateCursorFromSelection]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!activeBlock || cursor === null) return;

    justTypedRef.current = true;

    let newText = activeBlock.text;
    let newOffset = cursor.offset;

    if (e.key === "Backspace" && newOffset > 0) {
      e.preventDefault();
      newText = activeBlock.text.slice(0, newOffset - 1) + activeBlock.text.slice(newOffset);
      newOffset--;
    } else if (e.key === "Enter") {
      e.preventDefault();
      newText = activeBlock.text.slice(0, newOffset) + "\n" + activeBlock.text.slice(newOffset);
      newOffset++;
    } else if (e.key === "ArrowLeft" && newOffset > 0) {
      newOffset--;
    } else if (e.key === "ArrowRight" && newOffset < activeBlock.text.length) {
      newOffset++;
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      newText = activeBlock.text.slice(0, newOffset) + e.key + activeBlock.text.slice(newOffset);
      newOffset++;
    } else {
      return;
    }

    const newValue =
      value.slice(0, activeBlock.start) + newText + value.slice(activeBlock.end);

    onChange?.(newValue);
    setCursor({ blockId: activeBlock.id, offset: newOffset });
  }, [activeBlock, cursor, value, onChange]);

  useLayoutEffect(() => {
    if (!caretRef.current || !activeBlock || cursor === null) {
      caretRef.current && (caretRef.current.style.display = "none");
      return;
    }

    const blockEl = containerRef.current?.querySelector(`[data-block-id="${activeBlock.id}"] .content`) as HTMLElement;
    if (!blockEl) return;

    const textBefore = activeBlock.text.slice(0, cursor.offset);

    const measurer = document.createElement("span");
    measurer.style.visibility = "hidden";
    measurer.style.position = "absolute";
    measurer.style.whiteSpace = "pre-wrap";
    measurer.style.wordBreak = "break-word";
    const computed = window.getComputedStyle(blockEl);
    measurer.style.font = computed.font;
    measurer.style.lineHeight = computed.lineHeight;
    measurer.style.letterSpacing = computed.letterSpacing;

    const inlines = parseInlines(textBefore);
    inlines.forEach(inline => {
      const span = document.createElement("span");
      if (inline.type === "strong") span.style.fontWeight = "bold";
      if (inline.type === "em") span.style.fontStyle = "italic";
      if (inline.type === "code") span.style.fontFamily = "monospace";
      span.textContent = inline.pure;
      measurer.appendChild(span);
    });

    blockEl.appendChild(measurer);
    const rect = measurer.getBoundingClientRect();
    const blockRect = blockEl.getBoundingClientRect();
    measurer.remove();

    caretRef.current.style.display = "block";
    caretRef.current.style.left = `${rect.right - blockRect.left}px`;
    caretRef.current.style.top = `${blockRect.top}px`;
    caretRef.current.style.height = `${rect.height || 20}px`;
  }, [cursor, activeBlock, blocks]);

  return (
    <div
      ref={containerRef}
      className={`${styles.syntheticText} ${className}`}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{ position: "relative", outline: "none" }}
    >
      {blocks.map(block => (
        <SyntheticBlock
          key={block.id}
          block={block}
          isActive={block.id === cursor?.blockId}
          cursorOffset={block.id === cursor?.blockId ? cursor.offset : null}
          onActivate={(offset) => {
            setCursor({ blockId: block.id, offset });
            containerRef.current?.focus();
          }}
          onClick={() => {
            containerRef.current?.focus();
          }}
        />
      ))}
      <span ref={caretRef} className="blinking-caret" style={{ position: "absolute", width: "1px", background: "#fff", display: "none" }} />
    </div>
  );
};

export { Synth }


export function parseBlocks(text: string): Block[] {
    const lines = text.split("\n");
    const blocks: Block[] = [];
    let offset = 0;
  
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const start = offset;
      const end = offset + line.length + 1; // +1 for \n (except last line)
  
      let type: BlockType = "paragraph";
  
      if (line.trim() === "") {
        type = "empty";
      } else if (line.startsWith("# ")) {
        type = "heading";
      } else if (line.startsWith("> ")) {
        type = "block-quote";
      } else if (line.match(/^\s*[-*+]\s/)) {
        type = "list-item";
      }
  
      blocks.push({
        id: uuid(),
        type,
        text: line,
        start,
        end: i === lines.length - 1 ? text.length : end, // last block ends at full length
      });
  
      offset = end;
    }
  
    if (blocks.length === 0) {
      blocks.push({
        id: uuid(),
        type: "empty",
        text: "",
        start: 0,
        end: 0,
      });
    }
  
    return blocks;
  }

  export function parseInlines(text: string): Inline[] {
    const inlines: Inline[] = [];
    let i = 0;
  
    let loopCount = 0
    while (i < text.length) {
        if (++loopCount > 100) {
            console.error("Potential infinite loop detected", JSON.stringify(inlines, null, 2))
            break;
        }
      // Code spans: `code`
      if (text[i] === "`") {
        const end = text.indexOf("`", i + 1);
        if (end !== -1) {
          inlines.push({
            type: "code",
            synthetic: text.slice(i + 1, end),
            pure: text.slice(i, end + 1),
            start: i,
            end: end + 1,
          });
          i = end + 1;
          continue;
        }
        i++;
        continue;
      }
  
      // Bold: **
      if (text.slice(i, i + 2) === "**") {
        const end = text.indexOf("**", i + 2);
        if (end !== -1) {
          inlines.push({
            type: "strong",
            synthetic: text.slice(i + 2, end),
            pure: text.slice(i, end + 2),
            start: i,
            end: end + 2,
          });
          i = end + 2;
          continue;
        }
        i += 2;
        continue;
      }
  
      // Italic: *
      if (text[i] === "*" && (i === 0 || text[i - 1] !== "*")) {
        const end = text.indexOf("*", i + 1);
        if (end !== -1 && text.slice(i + 1, end).trim().length > 0) {
          inlines.push({
            type: "em",
            synthetic: text.slice(i + 1, end),
            pure: text.slice(i, end + 1),
            start: i,
            end: end + 1,
          });
          i = end + 1;
          continue;
        }
        i++;
        continue;
      }
  
      let next = i + 1;
      for (const delim of ["**", "*", "`"]) {
        const pos = text.indexOf(delim, i + 1);
        if (pos !== -1 && pos < next) {
          next = pos;
        }
      }
  
      const content = text.slice(i, next);
      if (content) {
        inlines.push({
          type: "text",
          synthetic: content,
          pure: content,
          start: i,
          end: next,
        });
      }
      i = next;
    }
  
    return inlines;
  }