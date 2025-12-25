import React from 'react'
import type { Block, Inline } from './Synth'
import { parseInlines } from './Synth'

interface SyntheticBlockProps {
    block: Block;
    isActive?: boolean;
    cursorOffset?: number | null;
    onActivate?: (offset: number) => void;
    onClick?: (e: React.MouseEvent) => void;
    onInput?: (newText: string) => void;
  }
  
  const SyntheticBlock: React.FC<SyntheticBlockProps> = ({
    block,
    isActive = false,
    cursorOffset = null,
    onActivate,
    onClick,
    onInput,
  }) => {
    const inlines = parseInlines(block.text);
  
    const handleClick = (e: React.MouseEvent) => {
      const offset = block.text.length;
      
      onActivate?.(offset);
      
      onClick?.(e);
    };
  
    const content = inlines.map((inline, i) => {
        const nearCursor =
          cursorOffset !== null &&
          (Math.abs(cursorOffset - inline.start) <= 8 || Math.abs(cursorOffset - inline.end) <= 8);
    
        if (inline.type === "strong") {
          return <strong key={i}>{inline.synthetic}</strong>;
        }
        if (inline.type === "em") {
          return <em key={i}>{inline.synthetic}</em>;
        }
        if (inline.type === "code") {
          return <code key={i} style={{ background: "#f0f0f0", padding: "0.2em 0.4em" }}>{inline.synthetic}</code>;
        }
    
        if (inline.pure !== inline.synthetic) {
          return (
            <span
              key={i}
              style={{
                opacity: isActive && nearCursor ? 1 : 0.3,
                color: isActive && nearCursor ? "#ff4444" : "inherit",
                userSelect: "none",
              }}
            >
              {inline.pure}
            </span>
          );
        }
    
        return <span key={i}>{inline.pure}</span>;
      });
  
    const blockElement = (() => {
      switch (block.type) {
        case "heading":
          const level = Math.min(block.text.match(/^#+/)?.[0].length || 1, 6);
          return React.createElement(`h${level}`, { style: { margin: "8px 0" } }, content);
        case "block-quote":
          return <blockquote style={{ borderLeft: "4px solid #ccc", paddingLeft: "16px" }}>{content}</blockquote>;
        case "list-item":
          return <div style={{ display: "flex" }}><span>•</span><div>{content}</div></div>;
        case "empty":
          return <p style={{ minHeight: "1.2em" }}><br /></p>;
        default:
          return <p style={{ margin: "8px 0" }}>{content || <br />}</p>;
      }
    })();
  
    return (
        <div data-block-id={block.id} style={{ padding: "4px 0" }}>
          <div className="content" onClick={handleClick}>{blockElement}</div>
        </div>
      );
  };

export default SyntheticBlock
