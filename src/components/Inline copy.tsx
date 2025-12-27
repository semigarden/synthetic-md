import React, { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { InlineContext } from '../oldHooks/useSynth';
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
    if (!ref.current) return;
  
    if (!focused && ref.current.textContent !== inline.synthetic) {
      ref.current.textContent = inline.synthetic;
    }
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
    // if (!ref.current) return;
    // if (ref.current.textContent === inline.synthetic) return;

    // onEdit?.(inline, ref.current.textContent ?? ""); // commit edits
    // ref.current.textContent = inline.synthetic; // render synthetic after committing
  }, [inline.synthetic, inline, onEdit]);

  const onInput = useCallback(() => {
    if (!ref.current) return;

    synth.saveCaret(inline, ref.current);

    const newText = synth.applyInlineEdit(
      inline,
      ref.current.textContent ?? ""
    );
  
    if (newText) {
      onEdit?.(inline, newText);
    }
  
    // onEdit?.(inline, ref.current.textContent ?? "");
  }, [inline, synth, onEdit]);

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

      onSplitBlock?.(inline.blockId, inline.start, caretOffset);
    }
  
    if (e.key === "Backspace") {
      const sel = window.getSelection();
      if (!sel || !sel.isCollapsed) return;

      const caretOffset = getCaretOffsetInInline(ref.current);

      const isEmptyInline = inline.pure.length === 0;
      const isAtStart = caretOffset === 0;

      if (!isAtStart && !isEmptyInline) return;

      e.preventDefault();
      synth.saveCaret(inline, ref.current);
      onMergePrev?.(inline);
    }
  }, [inline, onEdit, onMergePrev]);

  function getCaretOffsetInInline(el: HTMLElement | null): number {
    if (!el) return 0;

    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return 0;
  
    const range = sel.getRangeAt(0);
  
    if (range.startContainer.nodeType === Node.TEXT_NODE) {
      return range.startOffset;
    }
  
    return 0;
  }

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
      data-inline-id={inline.id}
      data-type={inline.type}
      style={{
        outline: focused ? "1px solid #4af" : "none",
        whiteSpace: "pre-wrap",
      }}
    />
  );
};

export default Inline;
