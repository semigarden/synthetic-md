
import React, { useEffect, useRef } from "react";

interface PureBlockProps {
  text: string;
  onChange: (e: React.ChangeEvent<HTMLDivElement>) => void;
  onBlur: () => void;
  autoFocus?: boolean;
}

const PureBlock: React.FC<PureBlockProps> = ({
  text,
  onChange,
  onBlur,
  autoFocus = false,
}) => {
  const divRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (divRef.current && autoFocus) {
      divRef.current.focus();
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(divRef.current);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, [autoFocus]);

  return (
    <div
      ref={divRef}
      contentEditable
      suppressContentEditableWarning
      onInput={onChange}
      onBlur={onBlur}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          onBlur();
        }
      }}
      style={{
        outline: "none",
        minHeight: "1.2em",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}
      dangerouslySetInnerHTML={{ __html: text.replace(/\n/g, "<br>") }}
    />
  );
};

export default PureBlock;
