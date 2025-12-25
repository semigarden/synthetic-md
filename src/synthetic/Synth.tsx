import React, { useRef, useLayoutEffect, useCallback, useState } from "react"
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

  const blocks = parseBlocks(buffer.text);
  const activeBlockIndex = findActiveBlock(blocks, buffer.cursor);
  const activeBlock = blocks[activeBlockIndex];

  const updateCaretPosition = useCallback(() => {
    if (!caretRef.current || !containerRef.current || activeBlockIndex === -1) {
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
    
    const contentEl = blockEl.firstElementChild || blockEl;
    
    const walker = document.createTreeWalker(
      contentEl,
      NodeFilter.SHOW_TEXT,
      null
    );
    
    let charCount = 0;
    let targetNode: Text | null = null;
    let targetOffset = 0;
    
    let node = walker.nextNode();
    while (node) {
      const textNode = node as Text;
      const nodeLength = textNode.textContent?.length || 0;
      
      if (charCount + nodeLength >= localOffset) {
        targetNode = textNode;
        targetOffset = localOffset - charCount;
        break;
      }
      
      charCount += nodeLength;
      node = walker.nextNode();
    }
    
    if (!targetNode) {
      const allTextNodes: Text[] = [];
      const textWalker = document.createTreeWalker(
        contentEl,
        NodeFilter.SHOW_TEXT,
        null
      );
      while (textWalker.nextNode()) {
        allTextNodes.push(textWalker.currentNode as Text);
      }
      
      if (allTextNodes.length > 0) {
        targetNode = allTextNodes[allTextNodes.length - 1];
        targetOffset = targetNode.textContent?.length || 0;
      } else {
        const range = document.createRange();
        range.selectNodeContents(contentEl);
        range.collapse(false);
        const rect = range.getBoundingClientRect();
        const blockRect = blockEl.getBoundingClientRect();
        
        caretRef.current.style.display = "block";
        caretRef.current.style.left = `${rect.left - blockRect.left}px`;
        caretRef.current.style.top = `${rect.top - blockRect.top}px`;
        caretRef.current.style.height = `${rect.height || 20}px`;
        return;
      }
    }
    
    const marker = document.createTextNode("\u200B");
    const parent = targetNode.parentNode;
    if (!parent) return;
    
    const textBefore = targetNode.textContent?.slice(0, targetOffset) || "";
    const textAfter = targetNode.textContent?.slice(targetOffset) || "";
    
    targetNode.textContent = textBefore;
    const afterNode = document.createTextNode(textAfter);
    
    if (targetNode.nextSibling) {
      parent.insertBefore(marker, targetNode.nextSibling);
      parent.insertBefore(afterNode, marker.nextSibling);
    } else {
      parent.appendChild(marker);
      parent.appendChild(afterNode);
    }
    
    const range = document.createRange();
    range.setStartBefore(marker);
    range.setEndBefore(marker);
    const rect = range.getBoundingClientRect();
    const blockRect = blockEl.getBoundingClientRect();
    
    targetNode.textContent = (textBefore + textAfter);
    marker.remove();
    afterNode.remove();
    
    caretRef.current.style.display = "block";
    caretRef.current.style.left = `${rect.left - blockRect.left}px`;
    caretRef.current.style.top = `${rect.top - blockRect.top}px`;
    caretRef.current.style.height = `${rect.height || 20}px`;
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
        // printable character
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
              <span style={{ fontWeight: "bold" }}>
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
    default:
      return <p style={{ margin: "8px 0" }}>{content}</p>;
  }
}

function renderInline(text: string): React.ReactNode[] {
  return text.split("**").map((part, i) =>
    i % 2 === 1 ? <strong key={i}>{part}</strong> : part
  );
}

export { Synth }
