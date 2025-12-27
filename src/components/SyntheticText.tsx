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

    useLayoutEffect(() => {
        synth.restoreCaret();
    });

    const handleInlineInput = useCallback((inline: InlineType, text: string, caretOffset: number) => {
        synth.saveCaret(inline.id, caretOffset);

        const nextMarkdown = synth.engine.applyInlineEdit(inline, text);

        synth.forceRender();

        onChange?.(nextMarkdown);
    }, [synth, onChange]);

    return (
        <div className={`${styles.syntheticText} ${className}`}>
            {synth.engine.blocks.map(block => (
                <Block
                    key={block.id}
                    block={block}
                    inlines={synth.engine.getInlines(block)}
                    onInlineInput={handleInlineInput}
                />
            ))}
        </div>
    )
});

SyntheticText.displayName = 'SyntheticText';

export { SyntheticText };
export default SyntheticText
