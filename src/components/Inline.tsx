import React, { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { Inline as InlineType } from '../hooks/createSynthEngine';
import styles from '../styles/Synth.module.scss';

const Inline: React.FC<{
  inline: InlineType;
  onInput: (payload: {
    inlineId: string;
    text: string;
    caretOffset: number;
  }) => void;
}> = ({ inline, onInput }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const [focused, setFocused] = useState(false);

  console.log("Inline", JSON.stringify(inline, null, 2))

  useLayoutEffect(() => {
    if (!ref.current || focused) return;

    if (ref.current.textContent !== inline.pure) {
      ref.current.textContent = inline.pure;
    }
  }, [inline.pure, focused]);

  const getCaretOffset = (): number => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return 0;

    const range = sel.getRangeAt(0);
    if (range.startContainer.nodeType === Node.TEXT_NODE) {
      return range.startOffset;
    }
    return 0;
  };

  const onFocus = useCallback(() => {
    setFocused(true);
    if (!ref.current) return;

    const offset = getCaretOffset();
    ref.current.textContent = inline.synthetic;

    requestAnimationFrame(() => {
      placeCaret(ref.current!, offset);
    });
  }, [inline.synthetic]);

  const onBlur = useCallback(() => {
    setFocused(false);
  }, []);

  const onInputHandler = useCallback(() => {
    if (!ref.current) return;

    onInput({
      inlineId: inline.id,
      text: ref.current.textContent ?? "",
      caretOffset: getCaretOffset(),
    });
  }, [inline.id, onInput]);

  return (
    <span
      ref={ref}
      id={inline.id}
      className={styles.inline}
      contentEditable
      suppressContentEditableWarning
      onFocus={onFocus}
      onBlur={onBlur}
      onInput={onInputHandler}
      data-inline-id={inline.id}
      data-type={inline.type}
      style={{
        whiteSpace: "pre-wrap",
        outline: focused ? "1px solid #4af" : "none",
      }}
    />
  );
};

function placeCaret(el: HTMLElement, offset: number) {
  const range = document.createRange();
  const sel = window.getSelection();
  const node = el.firstChild ?? el;

  range.setStart(node, Math.min(offset, node.textContent?.length ?? 0));
  range.collapse(true);

  sel?.removeAllRanges();
  sel?.addRange(range);
}

export default Inline;
