import React, { useRef, useLayoutEffect, useCallback, useState, useEffect } from "react"
import styles from "../styles/Synth.module.scss"

type TextBuffer = {
    text: string;
    cursor: number
  };
  
  interface Block {
    type: "paragraph" | "heading" | "block-quote" | "list-item" | "line-break";
    text: string;
    start: number;
    end: number;
  }
  
  type Token =
    | { type: "text"; content: string }
    | { type: "bold-delim"; content: string }
    | { type: "italic-delim"; content: string }
    | { type: "code-delim"; content: string };
  
  function tokenizeBlock(text: string): Token[] {
    const tokens: Token[] = [];
    let i = 0;
    while (i < text.length) {
      if (text.startsWith("**", i)) {
        tokens.push({ type: "bold-delim", content: "**" });
        i += 2;
      } else if (text.startsWith("*", i) && (i === 0 || text[i - 1] !== "*")) {
        tokens.push({ type: "italic-delim", content: "*" });
        i += 1;
      } else if (text.startsWith("`", i)) {
        tokens.push({ type: "code-delim", content: "`" });
        i += 1;
      } else {
        let next = text.length;
        for (const delim of ["**", "*", "`"]) {
          const pos = text.indexOf(delim, i);
          if (pos !== -1 && pos < next) next = pos;
        }
        tokens.push({ type: "text", content: text.slice(i, next) });
        i = next;
      }
    }
    return tokens;
  }

const Synth: React.FC<{
    className?: string
    value?: string
    onChange?: (e: React.ChangeEvent<HTMLDivElement>) => void
  }> = ({ className = "", value = "", onChange }) => {
    const containerRef = useRef<HTMLDivElement>(null);
  const caretRef = useRef<HTMLDivElement>(null);

  const [buffer, setBuffer] = useState<TextBuffer>({
    text: value,
    cursor: 0,
  });

  useEffect(() => {
    setBuffer((prev) => {
      if (value !== prev.text) {
        return {
          text: value,
          cursor: Math.min(prev.cursor, value.length),
        };
      }
      return prev;
    });
  }, [value]);

  const blocks = parseBlocks(buffer.text);
  const activeBlockIndex = findActiveBlock(blocks, buffer.cursor);
  const activeBlock = blocks[activeBlockIndex];

  const updateCaretPosition = useCallback(() => {
    if (!caretRef.current || !containerRef.current || activeBlockIndex === -1 || !activeBlock) {
        if (caretRef.current) {
            caretRef.current.style.display = "none";
        }
        return;
      }
    
      const blockEl = containerRef.current.querySelector(
        `[data-block-index="${activeBlockIndex}"]`
      ) as HTMLElement;
      if (!blockEl) return;
    
      const localOffset = buffer.cursor - activeBlock.start;
      const textBeforeCursor = activeBlock.text.slice(0, localOffset);
    
      const measurer = document.createElement("span");
      measurer.style.visibility = "hidden";
      measurer.style.position = "absolute";
      measurer.style.top = "0";
      measurer.style.left = "0";
      measurer.style.whiteSpace = "pre-wrap";
      measurer.style.wordBreak = "break-word";
      measurer.style.font = window.getComputedStyle(blockEl).font;
      measurer.style.lineHeight = window.getComputedStyle(blockEl).lineHeight;
      measurer.style.letterSpacing = window.getComputedStyle(blockEl).letterSpacing;
      measurer.textContent = textBeforeCursor || "\u200B";
    
      const contentWrapper = blockEl.querySelector("span") || blockEl;
      contentWrapper.appendChild(measurer);
    
      const measurerRect = measurer.getBoundingClientRect();
      const blockRect = blockEl.getBoundingClientRect();
    
      measurer.remove();
    
      caretRef.current.style.display = "block";
      caretRef.current.style.left = `${measurerRect.right - blockRect.left}px`;
      caretRef.current.style.top = `${measurerRect.top - blockRect.top}px`;
      caretRef.current.style.height = `${measurerRect.height || 20}px`;
  }, [buffer.cursor, activeBlockIndex, activeBlock?.text, activeBlock?.start]);

  useLayoutEffect(() => {
    updateCaretPosition();
  }, [updateCaretPosition]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      const blockEl = target.closest("[data-block-index]") as HTMLElement;
      if (!blockEl) return;

      const index = parseInt(blockEl.dataset.blockIndex!);
      const block = blocks[index];

      let offset = block.text.length;
      if (document.caretRangeFromPoint) {
        const range = document.caretRangeFromPoint(e.clientX, e.clientY);
        if (range && blockEl.contains(range.startContainer)) {
          const pre = document.createRange();
          pre.selectNodeContents(blockEl);
          pre.setEnd(range.startContainer, range.startOffset);
          offset = pre.toString().length;
        }
      }

      const globalPos = block.start + offset;
      setBuffer((b) => ({ ...b, cursor: globalPos }));
    },
    [blocks]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!activeBlock) return;

      let newText = buffer.text;
      let newCursor = buffer.cursor;

      if (e.key === "Backspace" && newCursor > 0) {
        e.preventDefault();
        newText =
          buffer.text.slice(0, newCursor - 1) + buffer.text.slice(newCursor);
        newCursor--;
      } else if (e.key === "Enter") {
        e.preventDefault();
        newText =
          buffer.text.slice(0, newCursor) +
          "\n" +
          buffer.text.slice(newCursor);
        newCursor++;
      } else if (e.key === "ArrowLeft" && newCursor > 0) {
        e.preventDefault();
        newCursor--;
      } else if (e.key === "ArrowRight" && newCursor < buffer.text.length) {
        e.preventDefault();
        newCursor++;
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        newText =
          buffer.text.slice(0, newCursor) + e.key + buffer.text.slice(newCursor);
        newCursor++;
      } else {
        return;
      }

      setBuffer({ text: newText, cursor: newCursor });
      onChange?.({
        ...e,
        target: { value: newText } as any,
        currentTarget: { value: newText } as any,
      } as React.ChangeEvent<HTMLDivElement>);
    },
    [buffer, activeBlock, onChange]
  );

  const renderActiveBlock = (block: Block) => {
    const localCursor = buffer.cursor - block.start;
    const tokens = tokenizeBlock(block.text);

    if (tokens.length === 0) {
      return <span>{"\u200B"}</span>;
    }

    let charCount = 0;
    return tokens.map((token, i) => {
      const tokenStart = charCount;
      const tokenEnd = charCount + token.content.length;
      charCount = tokenEnd;

      const isNearCursor =
        localCursor >= tokenStart - 10 && localCursor <= tokenEnd + 10;

      if (token.type === "text") {
        return <span key={i}>{token.content}</span>;
      }

      return (
        <span
          key={i}
          style={{
            opacity: isNearCursor ? 1 : 0.3,
            color: isNearCursor ? "#ff6b6b" : "transparent",
            userSelect: "none",
          }}
        >
          {token.content}
        </span>
      );
    });
  };

  return (
    <div
      ref={containerRef}
      className={`${styles.syntheticText} ${className}`}
      style={{ position: "relative", fontFamily: "inherit" }}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {blocks.map((block, i) => {
        const isActive = i === activeBlockIndex;

        return (
          <div
            key={block.start}
            data-block-index={i}
            style={{
              padding: "4px 0",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              minHeight: "1.2em",
              position: "relative",
            }}
          >
            {isActive ? (
              <span style={{ display: "inline" }}>
                {renderActiveBlock(block)}
              </span>
            ) : (
              renderBlock(block)
            )}
          </div>
        );
      })}

      <div
        ref={caretRef}
        className={styles.caret}
      />
    </div>
  );
};

function parseBlocks(text: string): Block[] {
  const lines = text.split("\n");
  const blocks: Block[] = [];
  let offset = 0;
  
  if (lines.length === 0 || (lines.length === 1 && lines[0] === "")) {
    return [{ type: "paragraph", text: "", start: 0, end: 0 }];
  }
  
  for (const line of lines) {
    const lineStart = offset;
    const lineEnd = offset + line.length;
    let type: Block["type"] = "paragraph";
    if (line.startsWith("# ")) type = "heading";
    else if (line.startsWith("> ")) type = "block-quote";
    else if (line.startsWith("- ")) type = "list-item";
    else if (line.trim() === "") type = "line-break";

    blocks.push({ type, text: line, start: lineStart, end: lineEnd });
    offset = lineEnd + 1;
  }
  return blocks;
}

function findActiveBlock(blocks: Block[], cursor: number): number {
  return blocks.findIndex((b) => cursor >= b.start && cursor <= b.end);
}

function renderBlock(block: Block): React.ReactNode {
  const content = renderInline(block.text);
  switch (block.type) {
    case "heading":
      const level = (block.text.match(/^#+/)?.[0].length || 1);
      return React.createElement(`h${Math.min(level, 6)}`, {}, content);
    case "block-quote":
      return <blockquote style={{ borderLeft: "4px solid #ccc", paddingLeft: "16px" }}>{content}</blockquote>;
    case "list-item":
      return (
        <div style={{ display: "flex" }}>
          <span style={{ marginRight: "8px" }}>•</span>
          <div>{content}</div>
        </div>
      );
    case "line-break":
      return <p style={{ margin: "8px 0", minHeight: "1.2em" }}>{content || "\u200B"}</p>;
    default:
      return <p style={{ margin: "8px 0", minHeight: "1.2em" }}>{content || "\u200B"}</p>;
  }
}

function renderInline(text: string): React.ReactNode[] {
  return text.split("**").map((part, i) =>
    i % 2 === 1 ? <strong key={i}>{part}</strong> : part
  );
}

export { Synth }
