import React, { useLayoutEffect, forwardRef, useCallback } from 'react'
import styles from '../styles/Synth.module.scss'
import Inline from './Inline'
import { useSynthController, type SyntheticTextRef } from '../hooks/useSynthController'

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

    const handleInlineInput = useCallback((inline: ReturnType<typeof synth.engine.getInlines>[number], text: string, caretOffset: number) => {
        synth.saveCaret(inline.id, caretOffset);

        const nextMarkdown = synth.engine.applyInlineEdit(inline, text);

        synth.forceRender();

        onChange?.(nextMarkdown);
    }, [synth.engine, onChange, synth.saveCaret]);

    return (
        <div className={`${styles.syntheticText} ${className}`}>
            {synth.engine.blocks.map(block =>
                <div key={block.id}>
                    {synth.engine.getInlines(block).map(inline => (
                        <Inline
                            key={inline.id}
                            inline={inline}
                            onInput={({ text, caretOffset }) => {
                                handleInlineInput(inline, text, caretOffset);
                            }}
                        />
                    ))}
                </div>
            )}
        </div>
    )
});

SyntheticText.displayName = 'SyntheticText';

export { SyntheticText };
export default SyntheticText
