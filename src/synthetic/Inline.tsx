import React, { useCallback, useEffect, useRef, useState } from 'react'
import styles from '../styles/Synth.module.scss'
import { type InlineContext } from './useSynth'


const Inline: React.FC<{
    className?: string;
    inline: InlineContext;
    onEdit?: (inline: InlineContext, text: string) => void;
}> = ({
    className = "",
    inline,
    onEdit = (_inline: InlineContext, _text: string) => {},
}) => {
    const inlineRef = useRef<HTMLSpanElement>(null)
    const [focus, setFocus] = useState(false)
    const [text, setText] = useState(inline.pure)

    const [selection, setSelection] = useState<{ start: number; end: number } | null>(null);
    
    const syncSelection = useCallback(() => {
        if (!inlineRef.current || !focus) return;
        
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;
        
        const range = sel.getRangeAt(0);
        if (!inlineRef.current.contains(range.commonAncestorContainer)) return;
        
        const preRange = document.createRange();
        preRange.selectNodeContents(inlineRef.current);
        preRange.setEnd(range.startContainer, range.startOffset);
        const start = preRange.toString().length;
        
        preRange.setEnd(range.endContainer, range.endOffset);
        const end = preRange.toString().length;
        
        setSelection({ start, end });
    }, [focus]);
    
    const updateDOMSelection = useCallback((cursorPos: number) => {
        setTimeout(() => {
            if (!inlineRef.current) return;
            
            const range = document.createRange();
            let textNode: Node | null = null;
            for (let i = 0; i < inlineRef.current.childNodes.length; i++) {
                const node = inlineRef.current.childNodes[i];
                if (node.nodeType === Node.TEXT_NODE) {
                    textNode = node;
                    break;
                }
            }
            
            if (textNode) {
                const textContent = textNode.textContent ?? '';
                const pos = Math.min(cursorPos, textContent.length);
                range.setStart(textNode, pos);
                range.setEnd(textNode, pos);
                const sel = window.getSelection();
                sel?.removeAllRanges();
                sel?.addRange(range);
            } else {
                range.selectNodeContents(inlineRef.current);
                range.collapse(false);
                const sel = window.getSelection();
                sel?.removeAllRanges();
                sel?.addRange(range);
            }
        }, 0);
    }, []);

    const onFocus = useCallback((e: React.FocusEvent<HTMLSpanElement>) => {
        e.preventDefault()
        e.stopPropagation()

        setFocus(true)
        setText(prev => prev || inline.pure);
        
        setTimeout(() => {
            syncSelection();
        }, 0);
    }, [inline.pure, syncSelection])
    
    const onMouseUp = useCallback(() => {
        if (focus) {
            syncSelection();
        }
    }, [focus, syncSelection])

    const onBlur = useCallback(() => {
        setFocus(false)
        setSelection(null)

    }, [text, inline, onEdit])
    
    useEffect(() => {
        if (!focus) {
            setText(inline.pure);
        }
    }, [inline.pure, focus])

    const onKeyDown = useCallback(    
        (e: React.KeyboardEvent<HTMLSpanElement>) => {
            if (!focus) return;
          
          if (e.key === 'Escape') {
            inlineRef.current?.blur();
            return;
          }
    
          if (e.key === 'Enter') {
            e.preventDefault();

            const currentStart = selection?.start ?? 0;
            const currentEnd = selection?.end ?? currentStart;
            const newText =
                text.slice(0, currentStart) + '\n' + text.slice(currentEnd);

            setText(newText);
            onEdit(inline, newText)

            const newCursorPos = currentStart + 1;
            setSelection({ start: newCursorPos, end: newCursorPos });
            updateDOMSelection(newCursorPos);
            
            return;
          }
    
          if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
            if (e.shiftKey || e.ctrlKey || e.metaKey) {
              setTimeout(() => syncSelection(), 0);
              return;
            }
            setTimeout(() => syncSelection(), 0);
            return;
          }
    
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
    
            const sel = window.getSelection();
            if (!sel || sel.rangeCount === 0) return;
            const range = sel.getRangeAt(0);
            const start = range.startOffset;
            const end = range.endOffset;
    
            const insertStart = selection?.start ?? start;
            const insertEnd = selection?.end ?? end;
    
            const newText = text.slice(0, insertStart) + e.key + text.slice(insertEnd);
    
            setText(newText);
            onEdit(inline, newText)
    
            const newCursorPos = insertStart + 1;
            setSelection({ start: newCursorPos, end: newCursorPos });
            updateDOMSelection(newCursorPos);
            
            return;
          }
    
          if (e.key === 'Backspace' || e.key === 'Delete') {
            e.preventDefault();
    
            let newText: string;
            let newCursorPos: number;
    
            if (selection?.start === selection?.end) {
              if (e.key === 'Backspace') {
                if (selection?.start! === 0) return;
                newText = text.slice(0, selection?.start! - 1) + text.slice(selection?.start!);
                newCursorPos = selection?.start! - 1;
              } else {
                if (selection?.start! === text.length) return;
                newText = text.slice(0, selection?.start!) + text.slice(selection?.start! + 1);
                newCursorPos = selection?.start ?? 0;
              }
            } else {
              newText = text.slice(0, selection?.start ?? 0) + text.slice(selection?.end ?? 0);
              newCursorPos = selection?.start ?? 0;
            }
    
            setText(newText);
            onEdit(inline, newText)
            setSelection({ start: newCursorPos, end: newCursorPos });
            updateDOMSelection(newCursorPos);
          }
        },
        [text, selection, inline, focus, onEdit, syncSelection, updateDOMSelection]
    );

    return (
        <span ref={inlineRef} className={`${styles.inline} ${className} ${focus && styles.focus}`}
            tabIndex={0}
            data-start={inline.start}
            data-end={inline.end}
            onFocus={onFocus}
            onBlur={onBlur}
            onKeyDown={onKeyDown}
            onMouseUp={onMouseUp}
        >
            {focus ? (
                text
            ) : (
                getInline(inline)
            )}
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
