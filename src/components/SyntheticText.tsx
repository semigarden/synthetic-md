import React, { useEffect, useLayoutEffect } from 'react'
import styles from '../styles/Synth.module.scss'
import Inline from './Inline'
import { useSynthController } from '../hooks/useSynthController'

const SyntheticText: React.FC<{
    className?: string;
    value: string;
    onChange?: (e: React.ChangeEvent<HTMLDivElement>) => void;
}> = ({
    className = "",
    value,
    onChange = () => {},
}) => {
    const synth = useSynthController(value)

    useLayoutEffect(() => {
        synth.restoreCaret();
    });

    return (
        <div
            className={`${styles.syntheticText} ${className}`}
        >
            { synth.blocks.map(block =>
                synth.getInlines(block).map(inline => (
                    <Inline
                        key={inline.id}
                        inline={inline}
                        onInput={({ inlineId, text, caretOffset }) => {
                            synth.saveCaret(inlineId, caretOffset);
                            const nextValue = synth.applyInlineEdit(inline, text);
                            onChange?.({
                                target: {
                                    value: nextValue,
                                },
                            } as unknown as React.ChangeEvent<HTMLDivElement>);
                        }}
                    />
                ))
            )}
        </div>
    )
}

export default SyntheticText
