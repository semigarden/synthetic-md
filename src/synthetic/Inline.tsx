import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { InlineContext } from './useSynth';

const Inline: React.FC<{
  inline: InlineContext;
  onEdit?: (inline: InlineContext, text: string) => void;
}> = ({ inline, onEdit }) => {
  const ref = useRef<HTMLSpanElement>(null);

  const [focused, setFocused] = useState(false);
  const [text, setText] = useState(inline.pure);

  useLayoutEffect(() => {
    if (!ref.current) return;
    ref.current.textContent = inline.synthetic;
  }, []);

  const onFocus = useCallback(() => {
    setFocused(true);
    if (!ref.current) return;
    ref.current.textContent = text;
    placeCaretAtEnd(ref.current);
  }, [text]);

  const onBlur = useCallback(() => {
    setFocused(false);
    if (!ref.current) return;
    ref.current.textContent = inline.synthetic;
    onEdit?.(inline, text);
  }, [inline.synthetic, text, onEdit]);

  const onInput = useCallback(() => {
    if (!ref.current) return;
    const next = ref.current.textContent ?? "";
    setText(next);
    // onEdit?.(inline, next);
  }, [inline, onEdit]);

  return (
    <span
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      tabIndex={0}
      onFocus={onFocus}
      onBlur={onBlur}
      onInput={onInput}
      style={{
        outline: focused ? "1px solid #4af" : "none",
        whiteSpace: "pre-wrap",
      }}
    />
  );
};

export default Inline;

function placeCaretAtEnd(el: HTMLElement) {
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}
