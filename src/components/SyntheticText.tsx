import React, { useRef } from 'react'
import styles from '../styles/Synth.module.scss'
import Block from './Block'
import useSynth, { type BlockContext, type InlineContext } from '../hooks/useSynth'


const SyntheticText: React.FC<{
    className?: string;
    value: string;
    onChange?: (e: React.ChangeEvent<HTMLDivElement>) => void;
}> = ({
    className = "",
    value,
    onChange = () => {},
}) => {
    const synth = useSynth()
    const syntheticRef = useRef<HTMLDivElement>(null)
    const blocks = synth.parseBlocks(value)

    // console.log("blocks", value, JSON.stringify(blocks, null, 2))

    const onBlockEdit = (block: BlockContext, text: string) => {
        const newText = value.slice(0, block.start) + text + value.slice(block.end)

        const event = {
            target: {
                value: newText,
            },
        } as unknown as React.ChangeEvent<HTMLDivElement>
        onChange?.(event)
        // const newType = newText.trim() === "" ? "empty" : synth.detectType(newText);

        // const newBlock: BlockContext = {
        //     ...block,
        //     text: newText,
        //     type: newType,
        //     end: block.start + newText.length,
        // };

        // // re-generate inlines based on new type
        // const newInlines = newType === "empty"
        //     ? [{
        //         id: `empty-${block.id}`,
        //         blockId: block.id,
        //         type: "text",
        //         pure: "",
        //         synthetic: "",
        //         start: 0,
        //         end: 0
        //     }]
        //     : synth.parseInlines(newBlock);

        // // update inline cache
        // synth.inlineCache.set(newBlock.id, newInlines as InlineContext[]);
    }

    // console.log("blocks", JSON.stringify(blocks, null, 2))

    function placeCaretAtEnd(el: HTMLElement) {
        const range = document.createRange();
        const sel = window.getSelection();
        const node = el.firstChild ?? el;
      
        const len = node.textContent?.length ?? 0;
        range.setStart(node, len);
        range.collapse(true);
      
        sel?.removeAllRanges();
        sel?.addRange(range);
    }

    const onClick = (e: React.MouseEvent) => {
        // If click happened inside an inline, do nothing
        console.log("onClick s", e.target)
        const target = e.target as HTMLElement;
        if (target.closest(`.${styles.inline}`)) return;
    
        // Find last block
        const lastBlock = blocks.at(-1);
        if (!lastBlock) return;
    
        const inlines = synth.parseInline(lastBlock);
        const lastInline = inlines.at(-1);
        if (!lastInline) return;
    
        const el = document.getElementById(lastInline.id);
        if (!el) return;
    
        el.focus();
    
        requestAnimationFrame(() => {
          placeCaretAtEnd(el);
        });
      };


    return (
        <div
            ref={syntheticRef}
            className={`${styles.syntheticText} ${className}`}
            onClick={onClick}
        >
            {blocks.map((block: BlockContext) => (
                <Block
                    key={block.id}
                    synth={synth}
                    block={block}
                    onBlockEdit={onBlockEdit}
                />
            ))}
        </div>
    )
}

export default SyntheticText
