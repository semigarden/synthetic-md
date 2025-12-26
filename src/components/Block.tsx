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
    const inlines = synth.parseInline(block)

    const onInlineEdit = (inline: InlineContext, text: string) => {
        const newText = block.text.slice(0, inline.start) + text + block.text.slice(inline.end)

        onBlockEdit(block, newText)
    }

    console.log("inlines", JSON.stringify(inlines, null, 2))

    return (
        <div className={`${styles.block} ${className}`}
            data-start={block.start}
            data-end={block.end}
            style={{
                minHeight: '1em',
            }}
            onClick={() => {
                if (inlines.length === 0) return;
                const firstInlineEl = document.getElementById(inlines[0].id);
                if (firstInlineEl) (firstInlineEl as HTMLElement).focus();
            }}
        >
            {inlines.map((inline: InlineContext) => (
                <Inline key={inline.id} inline={inline} onEdit={onInlineEdit} />
            ))}
        </div>
    )
}

export default Block
