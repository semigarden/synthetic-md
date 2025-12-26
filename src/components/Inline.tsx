import React, { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { InlineContext } from '../hooks/useSynth';
import styles from '../styles/Synth.module.scss';

const Inline: React.FC<{
  inline: InlineContext;
  onEdit?: (inline: InlineContext, text: string) => void;
}> = ({ inline, onEdit }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const [focused, setFocused] = useState(false);

  useLayoutEffect(() => {
    if (!ref.current || focused) return;
    ref.current.textContent = inline.synthetic;
  }, [inline.synthetic, focused]);

  const onFocus = useCallback(() => {
    setFocused(true);
    if (!ref.current) return;
    ref.current.textContent = inline.pure;
  }, [inline.pure]);
  
  const onBlur = useCallback(() => {
    setFocused(false);
    if (!ref.current) return;
    onEdit?.(inline, ref.current.textContent ?? ""); // commit edits
    ref.current.textContent = inline.synthetic; // render synthetic after committing
  }, [inline.synthetic, inline, onEdit]);

  const onInput = useCallback(() => {
    if (!ref.current) return;
    console.log("onInput", ref.current.textContent)
    // onEdit?.(inline, ref.current.textContent ?? "");
  }, []);

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
      data-type={inline.type}
      style={{
        outline: focused ? "1px solid #4af" : "none",
        whiteSpace: "pre-wrap",
      }}
    />
  );
};

export default Inline;
