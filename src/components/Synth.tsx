import React, { useRef, useEffect } from "react"
import { useMarkdownEditor } from "../oldHooks/useMarkdownEditor"
import styles from "../styles/SyntheticText.module.scss"
import type { SyntheticTextProps } from "../types"

const SyntheticText: React.FC<SyntheticTextProps> = ({
    className = "",
    text,
    onChange,
    value,
    onBlur,
    props,
}) => {
    const divRef = useRef<HTMLDivElement>(null)
    const isEditingRef = useRef(false)
    const markdownText = value !== undefined ? value : text
    const { html, render } = useMarkdownEditor(markdownText)

    useEffect(() => {
        if (divRef.current && !isEditingRef.current) {
            divRef.current.innerHTML = html
        }
    }, [html])

    const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
        if (divRef.current) {
            const plainText =
                divRef.current.innerText || divRef.current.textContent || ""

            const syntheticEvent = {
                ...e,
                target: {
                    ...e.currentTarget,
                    value: plainText,
                },
                currentTarget: {
                    ...e.currentTarget,
                    value: plainText,
                },
            } as React.ChangeEvent<HTMLDivElement>

            onChange?.(syntheticEvent)
        }
    }

    const handleFocus = () => {
        if (divRef.current) {
            divRef.current.textContent = markdownText
        }

        isEditingRef.current = true
    }

    const handleBlur = () => {
        if (divRef.current) {
            divRef.current.innerHTML = render(markdownText, { vision: "synthetic", cursor: null } )
        }

        isEditingRef.current = false
        onBlur?.()
    }

    return (
        <div
            ref={divRef}
            className={`${styles.syntheticText} ${className}`}
            contentEditable="true"
            onFocus={handleFocus}
            onInput={handleInput}
            onBlur={handleBlur}
            {...props}
        />
    )
}

export { SyntheticText }
