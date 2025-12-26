import React, { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { InlineContext } from '../hooks/useSynth';
import styles from '../styles/Synth.module.scss';

const Inline: React.FC<{
  inline: InlineContext;
  synth: any;
  onEdit?: (inline: InlineContext, text: string) => void;
  onMergePrev?: (inline: InlineContext) => void;
  onSplitBlock?: (inlineBlockId: string, inlineStart: number, caretOffset: number) => void;
}> = ({ inline, synth, onEdit, onMergePrev, onSplitBlock }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const [focused, setFocused] = useState(false);

  useLayoutEffect(() => {
    if (!ref.current || focused) return;
    ref.current.textContent = inline.synthetic;
  }, [inline.synthetic, focused]);

  const onFocus = useCallback(() => {
    setFocused(true);
    if (!ref.current) return;

    const sel = window.getSelection();
    const offset = sel?.anchorOffset ?? 0;

    ref.current.textContent = inline.pure;

    requestAnimationFrame(() => {
      placeCaret(ref.current as HTMLElement, offset);
    });
  }, [inline.pure]);
  
  const onBlur = useCallback(() => {
    setFocused(false);
    if (!ref.current) return;
    if (ref.current.textContent === inline.synthetic) return;

    onEdit?.(inline, ref.current.textContent ?? ""); // commit edits
    ref.current.textContent = inline.synthetic; // render synthetic after committing
  }, [inline.synthetic, inline, onEdit]);

  const onInput = useCallback(() => {
    if (!ref.current) return;
    // onEdit?.(inline, ref.current.textContent ?? "");
  }, []);

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLSpanElement>) => {
    if (!ref.current) return;

    if (e.key === "Enter") {
      e.preventDefault();

      const sel = window.getSelection();
      if (!sel || !sel.rangeCount) return;

      const range = sel.getRangeAt(0);
      let caretOffset = 0;

      if (range.endContainer.nodeType === Node.TEXT_NODE) {
        caretOffset = range.endOffset;
      } else {
        caretOffset = ref.current.textContent?.length ?? 0;
      }

      const blockEl = ref.current?.closest('[data-block-id]');
      if (!blockEl) return;

      console.log("blockEl", blockEl)

      onSplitBlock?.(inline.blockId, inline.start, caretOffset);
    }
  
    if (e.key === "Backspace") {
      const sel = window.getSelection();
      if (!sel || !sel.isCollapsed) return;

      const { anchorNode, anchorOffset } = sel;

      if (!ref.current.contains(anchorNode)) return;

      const textNode =
        anchorNode?.nodeType === Node.TEXT_NODE
          ? anchorNode
          : anchorNode?.firstChild;

      if (!textNode) return;

      if (anchorOffset !== 0) return;

      e.preventDefault();
      onMergePrev?.(inline);
    }
  }, [inline, onEdit, onMergePrev]);

  function placeCaret(el: HTMLElement, offset: number) {
    const range = document.createRange();
    const sel = window.getSelection();
    const node = el.firstChild ?? el;
  
    range.setStart(node, Math.min(offset, node.textContent?.length ?? 0));
    range.collapse(true);
  
    sel?.removeAllRanges();
    sel?.addRange(range);
  }

  return (
    <span
      ref={ref}
      className={styles.inline}
      id={inline.id}
      contentEditable
      suppressContentEditableWarning
      tabIndex={0}
      onFocus={onFocus}
      onBlur={onBlur}
      onInput={onInput}
      onKeyDown={onKeyDown}
      data-block-id={inline.blockId}
      data-type={inline.type}
      style={{
        outline: focused ? "1px solid #4af" : "none",
        whiteSpace: "pre-wrap",
      }}
    />
  );
};

export default Inline;
