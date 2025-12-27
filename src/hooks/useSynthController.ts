import React, { useCallback, useMemo, useReducer, useImperativeHandle } from "react";
import { createSynthEngine, type SynthEngine } from "./createSynthEngine";

export interface SyntheticTextRef {
    setValue: (text: string) => void;
    getValue: () => string;
    focus: () => void;
}

export function useSynthController(initialValue: string, ref: React.RefObject<SyntheticTextRef>) {
    const [, forceRender] = useReducer(x => x + 1, 0);

    const engine = useMemo<SynthEngine>(() => {
        const e = createSynthEngine();
        e.sync(initialValue);
        return e;
    }, []);

    const caretRef = React.useRef<{
        inlineId: string;
        offset: number;
    } | null>(null);

    useImperativeHandle(ref, () => ({
        setValue(text: string) {
            engine.sync(text);
            forceRender();
        },
        getValue() {
            return engine.sourceText;
        },
        focus() {
            const firstInline = engine.blocks[0];
            if (firstInline) {
                const inlines = engine.getInlines(firstInline);
                if (inlines[0]) {
                    document.getElementById(inlines[0].id)?.focus();
                }
            }
        },
    }), [engine]);

    const saveCaret = useCallback((inlineId: string, offset: number) => {
        caretRef.current = { inlineId, offset };
    }, []);

    const restoreCaret = useCallback(() => {
        const caret = caretRef.current;
        if (!caret) return;

        const el = document.getElementById(caret.inlineId);
        if (!el) return;

        const node = el.firstChild ?? el;
        const range = document.createRange();
        range.setStart(node, Math.min(caret.offset, node.textContent?.length ?? 0));
        range.collapse(true);

        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);

        caretRef.current = null;
    }, []);

    return {
        forceRender,
        saveCaret,
        restoreCaret,
        engine,
    };
}
  