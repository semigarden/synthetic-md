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


    return (
        <div ref={syntheticRef} className={`${styles.syntheticText} ${className}`}
        >
            {blocks.map((block: BlockContext) => (
                <Block key={block.id} synth={synth} block={block} onBlockEdit={onBlockEdit} />
            ))}
        </div>
    )
}

export default SyntheticText
