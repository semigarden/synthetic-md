import React from 'react'
import styles from '../styles/Synth.module.scss'
import Inline from './Inline'
import type { BlockContext, InlineContext } from '../hooks/useSynth'

const Block: React.FC<{
    className?: string;
    synth: any;
    block: BlockContext;
    onBlockEdit?: (block: BlockContext, text: string) => void;
}> = ({
    className = "",
    synth,
    block,
    onBlockEdit = (_block: BlockContext, _text: string) => {},
}) => {
    const inlines = synth.parseInlines(block)

    const onInlineEdit = (inline: InlineContext, text: string) => {
        const newText = block.text.slice(0, inline.start) + text + block.text.slice(inline.end)

        onBlockEdit(block, newText)
    }

    return (
        <p className={`${styles.block} ${className}`}
            data-start={block.start}
            data-end={block.end}
            contentEditable
            suppressContentEditableWarning
            style={{
                minHeight: '1em',
            }}
        >
            {inlines.map((inline: InlineContext) => (
                <Inline key={inline.id} inline={inline} onEdit={onInlineEdit} />
            ))}
        </p>
    )
}

export default Block
