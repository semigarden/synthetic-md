import React, { useLayoutEffect, forwardRef, useCallback } from 'react'
import Block from './Block'
import styles from '../styles/Synth.module.scss'
import { useSynthController, type SyntheticTextRef } from '../hooks/useSynthController'
import type { Inline as InlineType } from '../hooks/createSynthEngine'

export interface SyntheticTextProps {
    className?: string;
    initialValue?: string;
    onChange?: (text: string) => void;
}

const SyntheticText = forwardRef<SyntheticTextRef, SyntheticTextProps>(({
    className = "",
    initialValue = "",
    onChange,
}, ref) => {
    const synth = useSynthController(initialValue, ref as React.RefObject<SyntheticTextRef>);

    // useLayoutEffect(() => {
    //     synth.restoreCaret();
    // });

    const handleInlineInput = useCallback((inline: InlineType, text: string, caretOffset: number) => {
        
        const nextMarkdown = synth.engine.applyInlineEdit(inline, text);

        // console.log('nextMarkdown', JSON.stringify(nextMarkdown, null, 2), 'caretOffset', nextMarkdown.position.end);

        // synth.engine.sync(nextMarkdown.newSourceText);
        synth.forceRender();

        // console.log('blocks', JSON.stringify(synth.engine.blocks, null, 2));
        // console.log('nextMarkdown', nextMarkdown);
        // console.log('sourceText', synth.engine.sourceText);
        

        onChange?.(nextMarkdown.newSourceText);

    }, [synth]);

    const handleInlineSplit = useCallback((inline: InlineType, caretOffset: number) => {
        const { newSourceText, newBlockId } = synth.engine.splitBlockAtInline(inline, caretOffset);

        if (newBlockId) {
            requestAnimationFrame(() => {
                const newBlockInlines = synth.engine.blocks.find(b => b.id === newBlockId);
                if (newBlockInlines) {
                    const inlines = synth.engine.getInlines(newBlockInlines);
                    if (inlines.length > 0) {
                        const firstInline = inlines[0];
                        synth.saveCaret(firstInline.id, 0);
                        
                        const el = document.getElementById(firstInline.id);
                        if (el) {
                            el.focus();
                            requestAnimationFrame(() => {
                                const range = document.createRange();
                                const sel = window.getSelection();
                                const node = el.firstChild ?? el;
                                range.setStart(node, 0);
                                range.collapse(true);
                                sel?.removeAllRanges();
                                sel?.addRange(range);
                            });
                        }
                    }
                }
            });
        }

        synth.forceRender();

        onChange?.(newSourceText);
    }, [synth, onChange]);

    // const handleMergeWithPrevious = useCallback((inline: InlineType) => {
    //     // const result = synth.engine.mergeWithPreviousBlock(inline);
    //     // if (!result) return;

    //     // const { newSourceText, mergedBlockId, caretOffset } = result;

    //     // requestAnimationFrame(() => {
    //     //     const mergedBlock = synth.engine.blocks.find(b => b.id === mergedBlockId);
    //     //     if (mergedBlock) {
    //     //         const inlines = synth.engine.getInlines(mergedBlock);
    //     //         if (inlines.length > 0) {
    //     //             let targetInline = inlines[0];
    //     //             let inlineCaretOffset = caretOffset;
                    
    //     //             for (const inl of inlines) {
    //     //                 if (inl.position.start <= caretOffset && inl.position.end >= caretOffset) {
    //     //                     targetInline = inl;
    //     //                     inlineCaretOffset = caretOffset - inl.position.start;
    //     //                     break;
    //     //                 }
    //     //                 if (inl.position.end <= caretOffset) {
    //     //                     targetInline = inl;
    //     //                     inlineCaretOffset = inl.text.symbolic.length;
    //     //                 }
    //     //             }

    //     //             synth.saveCaret(targetInline.id, inlineCaretOffset);
                    
    //     //             const el = document.getElementById(targetInline.id);
    //     //             if (el) {
    //     //                 el.focus();
    //     //                 requestAnimationFrame(() => {
    //     //                     const range = document.createRange();
    //     //                     const sel = window.getSelection();
    //     //                     const node = el.firstChild ?? el;
    //     //                     const offset = Math.min(inlineCaretOffset, node.textContent?.length ?? 0);
    //     //                     range.setStart(node, offset);
    //     //                     range.collapse(true);
    //     //                     sel?.removeAllRanges();
    //     //                     sel?.addRange(range);
    //     //                 });
    //     //             }
    //     //         }
    //     //     }
    //     // });

    //     synth.forceRender();
    //     onChange?.(newSourceText);
    // }, [synth, onChange]);

    const handleMergeWithNext = useCallback((inline: InlineType) => {
        const result = synth.engine.mergeWithNextBlock(inline);
        if (!result) return;

        const { newSourceText, currentBlockId, caretOffset } = result;

        requestAnimationFrame(() => {
            const currentBlock = synth.engine.blocks.find(b => b.id === currentBlockId);
            if (currentBlock) {
                const inlines = synth.engine.getInlines(currentBlock);
                if (inlines.length > 0) {
                    let targetInline = inlines[inlines.length - 1];
                    let inlineCaretOffset = caretOffset;
                    
                    for (const inl of inlines) {
                        if (inl.position.start <= caretOffset && inl.position.end >= caretOffset) {
                            targetInline = inl;
                            inlineCaretOffset = caretOffset - inl.position.start;
                            break;
                        }
                    }

                    synth.saveCaret(targetInline.id, inlineCaretOffset);
                    
                    const el = document.getElementById(targetInline.id);
                    if (el) {
                        el.focus();
                        requestAnimationFrame(() => {
                            const range = document.createRange();
                            const sel = window.getSelection();
                            const node = el.firstChild ?? el;
                            const offset = Math.min(inlineCaretOffset, node.textContent?.length ?? 0);
                            range.setStart(node, offset);
                            range.collapse(true);
                            sel?.removeAllRanges();
                            sel?.addRange(range);
                        });
                    }
                }
            }
        });

        synth.forceRender();
        onChange?.(newSourceText);
    }, [synth, onChange]);

    return (
        <div className={`${styles.syntheticText} ${className}`}>
            {synth.engine.blocks.map(block => (
                <Block
                    key={block.id}
                    synth={synth}
                    block={block}
                    onChange={onChange}
                    inlines={synth.engine.getInlines(block)}
                    onInlineInput={handleInlineInput}
                    onInlineSplit={handleInlineSplit}
                    // onMergeWithPrevious={handleMergeWithPrevious}
                    onMergeWithNext={handleMergeWithNext}
                />
            ))}
        </div>
    )
});

SyntheticText.displayName = 'SyntheticText';

export { SyntheticText };
export default SyntheticText
