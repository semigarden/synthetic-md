import React, { useCallback, useEffect, useRef, useState } from 'react'
import styles from '../styles/Synth.module.scss'
import type { InlineContext } from './useSynth'

const Inline: React.FC<{
    className?: string;
    inline: InlineContext;
    onEdit?: (inline: InlineContext, text: string) => void;
}> = ({
    className = "",
    inline,
    onEdit = (inline: InlineContext, text: string) => {},
}) => {
    const inlineRef = useRef<HTMLSpanElement>(null)
    const [focus, setFocus] = useState(false)
    const [text, setText] = useState(inline.pure)

    useEffect(() => {
        if (focus) {
            setText(inline.pure);
        }
    }, [focus, inline.pure]);

    const [selection, setSelection] = useState<{ start: number; end: number } | null>(null);

    // console.log("inline", JSON.stringify(inline, null, 2))

    useEffect(() => {
        if (!focus || !inlineRef.current || selection === null) return;
    
        const textNode = inlineRef.current.firstChild || inlineRef.current;
        const sel = window.getSelection();
        if (!sel) return;
    
        try {
            const range = document.createRange();
            range.setStart(textNode, Math.min(selection.start, text.length));
            range.setEnd(textNode, Math.min(selection.end, text.length));
            sel.removeAllRanges();
            sel.addRange(range);
        } catch (e) {
        }
    }, [text, focus, selection]);
    
    const saveSelection = () => {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;
    
        const range = sel.getRangeAt(0);
        const textNode = inlineRef.current?.firstChild || inlineRef.current;
        if (!textNode || !range.commonAncestorContainer.contains(textNode)) return;
    
        setSelection({
            start: range.startOffset,
            end: range.endOffset,
        });
    };

    const onFocus = useCallback((e: React.FocusEvent<HTMLSpanElement>) => {
        e.preventDefault()
        e.stopPropagation()

        setFocus(true)
        setText(prev => prev || inline.pure);
    }, [inline.synthetic])

    const onBlur = useCallback((e: React.FocusEvent<HTMLSpanElement>) => {
        e.preventDefault()
        e.stopPropagation()

        setFocus(false)
        setSelection(null)
        onEdit(inline, text)
    }, [text, inline, onEdit])

    const onKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLSpanElement>) => {
          if (e.key === 'Escape') {
            inlineRef.current?.blur();
            return;
          }
    
          if (e.key === 'Enter') {
            e.preventDefault();

            saveSelection();

            if (!selection) return;

            const insertPos = selection.start;
            const deleteEnd = selection.start !== selection.end ? selection.end : selection.start;

            const newText =
                text.slice(0, insertPos) + '\n' + text.slice(deleteEnd);

            setText(newText);
            // onEdit(inline, newText)

            const newCursorPos = insertPos + 1;
            setSelection({ start: newCursorPos, end: newCursorPos });
            
            return;
          }
    
          if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
            if (e.shiftKey || e.ctrlKey || e.metaKey) {
              return;
            }
            saveSelection();
            return;
          }
    
          saveSelection();
    
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
    
            const sel = window.getSelection();
            if (!sel || sel.rangeCount === 0) return;
            const range = sel.getRangeAt(0);
            const start = range.startOffset;
            const end = range.endOffset;
    
            const newText = selection
              ? text.slice(0, selection.start) + e.key + text.slice(selection.end)
              : text.slice(0, start) + e.key + text.slice(end);
    
            setText(newText);
            // onEdit(inline, newText)
    
            setSelection({ start: (selection?.start || start) + 1, end: (selection?.start || start) + 1 });
            return;
          }
    
          // Backspace / Delete
          if (e.key === 'Backspace' || e.key === 'Delete') {
            e.preventDefault();
    
            if (!selection) return;
    
            let newText: string;
            let newCursorPos: number;
    
            if (selection.start === selection.end) {
              if (e.key === 'Backspace') {
                if (selection.start === 0) return;
                newText = text.slice(0, selection.start - 1) + text.slice(selection.start);
                newCursorPos = selection.start - 1;
              } else {
                if (selection.start === text.length) return;
                newText = text.slice(0, selection.start) + text.slice(selection.start + 1);
                newCursorPos = selection.start;
              }
            } else {
              newText = text.slice(0, selection.start) + text.slice(selection.end);
              newCursorPos = selection.start;
            }
    
            setText(newText);
            // onEdit(inline, newText)
            setSelection({ start: newCursorPos, end: newCursorPos });
          }
        },
        [text, selection, inline]
    );
    // console.log("text", JSON.stringify(inline, null, 2), text)

    return (
        <span ref={inlineRef} className={`${styles.inline} ${className}`}
            tabIndex={0}
            data-start={inline.start}
            data-end={inline.end}
            onFocus={onFocus}
            onBlur={onBlur}
            onKeyDown={focus ? onKeyDown : undefined}
            onMouseUp={focus ? saveSelection : undefined}
            onKeyUp={focus ? saveSelection : undefined}
            onKeyPress={(e) => e.key === 'Enter' && e.preventDefault()}
        >
            {focus ? text : getInline(inline)}
        </span>
    )
}

function getInline(inline: InlineContext) {
    switch (inline.type) {
        case "text":
            return inline.pure
        case "strong":
            return <strong>{inline.synthetic}</strong>
        case "em":
            return <em>{inline.synthetic}</em>
        case "code":
            return <code>{inline.synthetic}</code>
        case "link":
            return <a href={inline.synthetic}>{inline.synthetic}</a>
    }

    return `${inline.synthetic}`
}

export default Inline
