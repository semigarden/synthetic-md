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
  onSplit?: (payload: {
    inlineId: string;
    caretOffset: number;
  }) => void;
  onMergeWithPrevious?: (payload: { inlineId: string }) => void;
  onMergeWithNext?: (payload: { inlineId: string }) => void;
  isFirstInline?: boolean;
  isLastInline?: boolean;
}> = ({ inline, onInput, onSplit, onMergeWithPrevious, onMergeWithNext, isFirstInline, isLastInline }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const [focused, setFocused] = useState(false);

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

  const onKeyDownHandler = useCallback((e: React.KeyboardEvent) => {
    const caretOffset = getCaretOffset();
    const textLength = ref.current?.textContent?.length ?? 0;

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      
      if (onSplit) {
        onSplit({
          inlineId: inline.id,
          caretOffset,
        });
      }
      return;
    }

    if (e.key === 'Backspace' && caretOffset === 0 && isFirstInline && onMergeWithPrevious) {
      e.preventDefault();
      onMergeWithPrevious({ inlineId: inline.id });
      return;
    }

    if (e.key === 'Delete' && caretOffset === textLength && isLastInline && onMergeWithNext) {
      e.preventDefault();
      onMergeWithNext({ inlineId: inline.id });
      return;
    }
  }, [inline.id, onSplit, onMergeWithPrevious, onMergeWithNext, isFirstInline, isLastInline]);

  if (inline.type === 'hardBreak') {
    return <br data-inline-id={inline.id} data-type={inline.type} />;
  }

  if (inline.type === 'softBreak') {
    return <span data-inline-id={inline.id} data-type={inline.type}> </span>;
  }

  if (inline.type === 'image') {
    const imageInline = inline as any;
    return (
      <span
        data-inline-id={inline.id}
        data-type={inline.type}
        className={styles.inline}
        title={imageInline.title || imageInline.alt}
      >
        <img 
          src={imageInline.url} 
          alt={imageInline.alt} 
          style={{ maxWidth: '100%', height: 'auto' }}
        />
      </span>
    );
  }

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!focused && inline.type === 'link') {
      const linkInline = inline as any;
      if (e.ctrlKey || e.metaKey) {
        window.open(linkInline.url, '_blank');
        e.preventDefault();
      }
    }
    if (!focused && inline.type === 'autolink') {
      const autolinkInline = inline as any;
      if (e.ctrlKey || e.metaKey) {
        window.open(autolinkInline.url, '_blank');
        e.preventDefault();
      }
    }
  }, [focused, inline]);

  return (
    <span
      ref={ref}
      id={inline.id}
      className={`${styles.inline} ${focused ? styles.focus : ''}`}
      contentEditable
      suppressContentEditableWarning
      onFocus={onFocus}
      onBlur={onBlur}
      onInput={onInputHandler}
      onKeyDown={onKeyDownHandler}
      onClick={handleClick}
      data-inline-id={inline.id}
      data-type={inline.type}
      title={getInlineTitle(inline)}
    />
  );
};

function getInlineTitle(inline: InlineType): string | undefined {
  switch (inline.type) {
    case 'link':
      return `${(inline as any).url}${(inline as any).title ? ` - ${(inline as any).title}` : ''} (Ctrl+Click to open)`;
    case 'autolink':
      return `${(inline as any).url} (Ctrl+Click to open)`;
    case 'image':
      return (inline as any).alt || (inline as any).url;
    case 'footnoteRef':
      return `Footnote: ${(inline as any).label}`;
    case 'emoji':
      return `:${(inline as any).name}:`;
    default:
      return undefined;
  }
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

export default Inline;
