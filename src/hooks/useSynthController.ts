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
        blockId: string;
        inlineId: string;
        position: number;
        affinity?: "forward" | "backward";
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

    const saveCaret = useCallback((blockId: string, inlineId: string, position: number) => {
        console.log('saveCaret', blockId, inlineId, position);
        caretRef.current = { blockId, inlineId, position };
    }, []);

    const restoreCaret = useCallback(() => {
        const caret = caretRef.current;
        console.log('restoreCaret', caret);
        if (!caret) return;


        const blockEl = findClosestBlock(engine.blocks, caret.position);
        // console.log('closestBlock', JSON.stringify(blockEl, null, 2));
 
        if (!blockEl) return;

        const inlineEl = findClosestInline(engine.getInlines(blockEl), caret.position);
        // console.log('closestInline', JSON.stringify(inlineEl, null, 2));

        const elId = inlineEl?.id ?? blockEl?.id;

        const el = document.getElementById(elId);
        if (!el) return;

        requestAnimationFrame(() => {
            const range = document.createRange();
            const sel = window.getSelection();
            const node = el.firstChild ?? el;
            range.setStart(node, Math.min(caret.position, node.textContent?.length ?? 0));
            range.collapse(true);
            sel?.removeAllRanges();
            sel?.addRange(range);
        });
        // const node = el.firstChild ?? el;
        // const range = document.createRange();
        // range.setStart(node, Math.min(caret.offset, node.textContent?.length ?? 0));
        // range.collapse(true);

        // const sel = window.getSelection();
        // sel?.removeAllRanges();
        // sel?.addRange(range);

        caretRef.current = null;
    }, []);

    function findInnermostBlock(block: any, offset: number): any | null {
        if (!block.position) return null;
      
        // Check if offset is inside this block
        if (offset < block.position.start || offset > block.position.end) return null;
      
        // Try children first
        if (block.children) {
          for (const child of block.children) {
            const inner = findInnermostBlock(child, offset);
            if (inner) return inner; // return the deepest match
          }
        }
      
        // If no child matches, this block is the innermost
        return block;
      }
      
    // Usage for a tree of blocks
    function findClosestBlock(blocks: any[], offset: number) {
    for (const block of blocks) {
        const match = findInnermostBlock(block, offset);
        if (match) return match;
    }
    return null;
    }

    function findClosestInline(inlines: any[], offset: number) {
        let closest: any = null;
        let minDistance = Infinity;
      
        for (const inline of inlines) {
          const dist = Math.min(Math.abs(offset - inline.position.start), Math.abs(offset - inline.position.end));
          if (dist < minDistance) {
            minDistance = dist;
            closest = inline;
          }
        }
      
        return closest;
    }

    return {
        forceRender,
        saveCaret,
        restoreCaret,
        engine,
    };
}
  