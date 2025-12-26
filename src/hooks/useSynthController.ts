import { useRef } from "react";

import { createSynthEngine, type SynthEngine } from "./createSynthEngine";

export function useSynthController(value: string) {
    const engineRef = useRef<SynthEngine>(null);

    const caretRef = useRef<{
        inlineId: string;
        offset: number;
    } | null>(null);

    if (!engineRef.current) {
        engineRef.current = createSynthEngine();
    }

    const engine = engineRef.current;

    engine.sync(value);

    function saveCaret(inlineId: string, offset: number) {
        console.log("saveCaret", inlineId, offset)
        caretRef.current = { inlineId, offset };
    }

    function restoreCaret() {
        const caret = caretRef.current;
        if (!caret) return;

        const el = document.getElementById(caret.inlineId);
        console.log("restoreCaret", caret.inlineId, el)

        if (!el) return;
        
        const node = el.firstChild ?? el;
        const range = document.createRange();
        range.setStart(node, Math.min(caret.offset, node.textContent?.length ?? 0));
        range.collapse(true);

        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);

        caretRef.current = null;
    }

    return {
        blocks: engine.blocks,
        getInlines: engine.getInlines,
        applyInlineEdit: engine.applyInlineEdit,
        syncExternalValue(value: string) {
            engine.sync(value);
        },
        saveCaret,
        restoreCaret,
    };
}
  