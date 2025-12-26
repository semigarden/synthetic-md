import React, { useState } from 'react'
import styles from '../styles/Synth.module.scss'
import Inline from './Inline'
import type { BlockContext, InlineContext } from './useSynth'
import useSynth from './useSynth'

const Block: React.FC<{
    className?: string;
    block: BlockContext;
    onBlockEdit?: (block: BlockContext, text: string) => void;
}> = ({
    className = "",
    block,
    onBlockEdit = (block: BlockContext, text: string) => {},
}) => {
    const { parseInlines } = useSynth()

    const inlines = parseInlines(block)

    const onInlineEdit = (inline: InlineContext, text: string) => {
        console.log("onEdit", inline, text)
        const newText = block.text.slice(0, inline.start) + text + block.text.slice(inline.end)

        onBlockEdit(block, newText)

        // console.log("newText", newText)
    }

    return (
        <p className={`${styles.block} ${className}`}
            data-start={block.start}
            data-end={block.end}
            style={{
                minHeight: '1em',
            }}
        >
            {inlines.map((inline) => (
                <Inline key={inline.id} inline={inline} onEdit={onInlineEdit} />
            ))}
        </p>
    )
}

export default Block
