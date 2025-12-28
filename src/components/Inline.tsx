import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Inline as InlineType } from '../hooks/createSynthEngine';
import styles from '../styles/Synth.module.scss';
import type { useSynthController } from '../hooks/useSynthController';

const Inline: React.FC<{
  synth: ReturnType<typeof useSynthController>;
  inline: InlineType;
  onChange?: (text: string) => void;
  onInput: (payload: {
    inlineId: string;
    text: string;
    position: number;
  }) => void;
  onSplit?: (payload: {
    inlineId: string;
    position: number;
  }) => void;
  onMergeWithPrevious?: (payload: { inlineId: string }) => void;
  onMergeWithNext?: (payload: { inlineId: string }) => void;
  isFirstInline?: boolean;
  isLastInline?: boolean;
}> = ({ synth, inline, onChange, onInput, onSplit, onMergeWithPrevious, onMergeWithNext, isFirstInline, isLastInline }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const [focused, setFocused] = useState(false);
  
  console.log('Inline', JSON.stringify(inline, null, 2));

  useEffect(() => {
    synth.restoreCaret();
  }, []);

  useLayoutEffect(() => {
    if (!ref.current || focused) return;

    if (ref.current.textContent !== inline.text.semantic) {
      ref.current.textContent = inline.text.semantic;
    }

    // synth.restoreCaret();
  }, [inline.text.semantic, focused]);

  function getCaretOffset(inlineEl: HTMLElement) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return 0;
  
    const range = sel.getRangeAt(0);
    let offset = 0;
  
    function traverse(node: Node): boolean {
      if (node === range.startContainer) {
        offset += range.startOffset;
        return true; // found
      }
      for (let child of node.childNodes) {
        if (traverse(child)) return true;
      }
      // add text length if traversing text nodes before the selection
      if (node.nodeType === Node.TEXT_NODE) {
        offset += (node as Text).length;
      }
      return false;
    }
  
    traverse(inlineEl);
    return offset;
  }

  const onFocus = useCallback(() => {
    setFocused(true);
    if (!ref.current) return;

    const offset = getCaretOffset(ref.current);
    ref.current.textContent = inline.text.symbolic;

    requestAnimationFrame(() => {
      placeCaret(ref.current!, offset);
    });
  }, [inline.text.symbolic]);

  const onBlur = useCallback(() => {
    setFocused(false);
  }, []);

  const onInputHandler = useCallback(() => {
    if (!ref.current) return;

    const caretPosition = getCaretOffset(ref.current);
    console.log('onInputHandler', caretPosition);

    synth.saveCaret(inline.id, caretPosition);


    onInput({
      inlineId: inline.id,
      text: ref.current.textContent ?? "",
      position: caretPosition,
    });
  }, [inline.id, onInput]);

  const onKeyDownHandler = useCallback((e: React.KeyboardEvent) => {
    if (!ref.current) return;
    const position = getCaretOffset(ref.current);
    const textLength = ref.current?.textContent?.length ?? 0;

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      
      if (onSplit) {
        onSplit({
          inlineId: inline.id,
          position,
        });
      }
      return;
    }

    if (e.key === 'Backspace') {
      e.preventDefault();

      const block = synth.engine.findBlockById(synth.engine.blocks, inline.blockId);

      if (!block) return;
  
      const blockInlines = synth.engine.inlines.get(block.id);
      if (!blockInlines) return;
  
      const inlineIndex = blockInlines.findIndex(i => i.id === inline.id);
  
      if (position === 0 && inlineIndex === 0) {
          const prevBlock = synth.engine.blocks[synth.engine.blocks.findIndex(b => b.id === block.id) - 1];

          if (prevBlock) {
            console.log('1');
              const result = synth.engine.mergeWithPreviousBlock(inline);
              synth.saveCaret(inline.id, result?.caretOffset ?? 0);

              if (result) {
                synth.forceRender();
                onChange?.(result.newSourceText);
              }
          }
          return;
      }
  
      if (position === 0 && inlineIndex > 0) {
        console.log('2');
        const prevInline = blockInlines[inlineIndex - 1];

        prevInline.text.symbolic = prevInline.text.symbolic.slice(0, -1);
    
        const mergedText = prevInline.text.symbolic + inline.text.symbolic;

        synth.forceRender();
        onChange?.(mergedText);
        synth.saveCaret(prevInline.id, prevInline.text.symbolic.length);
        return;
      }

      if (position > 0) {
        console.log('3 and position', position);
        let textToEdit = inline.text.symbolic;

        const newSymbolic = textToEdit.slice(0, position - 1) + textToEdit.slice(position);
        synth.saveCaret(inline.id, position - 1);
        synth.engine.applyInlineEdit(inline, newSymbolic);

        synth.forceRender();
        onChange?.(inline.text.semantic);
        return;
      }
  
      return;
    }
  
    // if (e.key === 'Backspace' && caretOffset === 0 && isFirstInline && onMergeWithPrevious) {
    //   e.preventDefault();
    //   onMergeWithPrevious({ inlineId: inline.id });
    //   return;
    // }

    if (e.key === 'Delete' && position === textLength && isLastInline && onMergeWithNext) {
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
