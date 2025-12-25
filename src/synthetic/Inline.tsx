import React, { useRef } from 'react'

export type InlineType = "text" | "strong" | "em" | "code" | "link" | "image" | "autolink" | "html" | "softbreak" | "hardbreak"

interface Inline {
    type: InlineType
    synthetic: string
    pure: string
    start: number
    end: number
}

const Inline: React.FC<Inline> = ({
    type,
    id,
    blockId,
    pureText,
    syntheticText,
    start,
    end,
}) => {
    const mode = useRef<"pure" | "synthetic">("pure")

    if (mode.current === "pure") {
        return (
            <span
                id={id}
                data-start={start}
                data-end={end}
                data-type={type}
            >{pureText}</span>
        )
    }

    return (
        <span
            id={id}
            data-start={start}
            data-end={end}
            data-type={type}
        >{syntheticText}</span>
    )
}

export default Inline
export type { Inline }
