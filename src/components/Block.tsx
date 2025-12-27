import React from 'react'
import styles from '../styles/Synth.module.scss'
import Inline from './Inline'
import type { BlockContext, InlineContext } from '../oldHooks/useSynth'

const Block: React.FC<{
    className?: string;
    synth: any;
    block: BlockContext;
    onBlockEdit?: (block: BlockContext, text: string) => void;
    onMergePrev?: (inline: InlineContext) => void;
    onSplitBlock?: (inlineBlockId: string, inlineStart: number, caretOffset: number) => void;
}> = ({
    className = "",
    synth,
    block,
    onBlockEdit = (_block: BlockContext, _text: string) => {},
    onMergePrev = (_inline: InlineContext) => {},
    onSplitBlock = (_inlineBlockId: string, _inlineStart: number, _caretOffset: number) => {},
}) => {
    const inlines = synth.parseInline(block)

    const onInlineEdit = (inline: InlineContext, text: string) => {
        const newText = block.text.slice(0, inline.start) + text + block.text.slice(inline.end)

        onBlockEdit(block, newText)
    }


    return (
        <div className={`${styles.block} ${className}`}
            data-block-id={block.id}
            data-start={block.start}
            data-end={block.end}
            style={{
                minHeight: '1em',
            }}
            onClick={(e) => {
                e.stopPropagation();
                if (inlines.length === 0) return;
                const firstInlineEl = document.getElementById(inlines[0].id);
                if (firstInlineEl) (firstInlineEl as HTMLElement).focus();
            }}
        >
            {inlines.map((inline: InlineContext) => (
                <Inline key={inline.id} inline={inline} synth={synth} onEdit={onInlineEdit} onMergePrev={onMergePrev} onSplitBlock={onSplitBlock} />
            ))}
        </div>
    )
}

export default Block
