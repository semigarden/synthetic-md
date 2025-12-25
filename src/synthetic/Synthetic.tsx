import React, { useRef, useEffect, useCallback } from "react"
import styles from "../styles/SyntheticText.module.scss"
import type { SyntheticTextProps } from "../types"
import type { Block } from "@/types/block"

type TextBuffer = {
    text: string
    selection: {
        start: number,
        end: number,
    }
}

const Synthetic: React.FC<SyntheticTextProps> = ({
    className = "",
    text,
    onChange,
    value,
    onBlur,
    props,
}) => {
    const syntheticRef = useRef<HTMLDivElement>(null) 
    const syntheticText = value !== undefined ? value : text
    const syntheticTextRef = useRef<{ text: string, selection: { start: number, end: number } }>({ text: syntheticText, selection: { start: 0, end: 0 } })
    // syntheticTextRef.current = { text: syntheticText, selection: { start: 0, end: 0 } }
    
    const isEditingRef = useRef(false)
    console.log("syntheticTextRef", JSON.stringify(syntheticTextRef.current, null, 2))

    const handleInput = useCallback((e: React.FormEvent<HTMLDivElement>) => {
        if (!syntheticRef.current) return
        
        const syntheticEvent = {
            ...e,
            target: { ...e.currentTarget, value: syntheticText },
            currentTarget: { ...e.currentTarget, value: syntheticText },
        } as React.ChangeEvent<HTMLDivElement>

        onChange?.(syntheticEvent)
    }, [onChange, syntheticText])

    const handleFocus = useCallback(() => {
        isEditingRef.current = true
    }, [])

    const handleBlur = useCallback(() => {
        isEditingRef.current = false
        syntheticTextRef.current = { text: syntheticText, selection: { start: 0, end: 0 } }
        onBlur?.()
    }, [syntheticText, onBlur])


    return (
        <div
            ref={syntheticRef}
            className={`${styles.syntheticText} ${className}`}
            contentEditable="true"
            onFocus={handleFocus}
            onInput={handleInput}
            onBlur={handleBlur}
            suppressContentEditableWarning
            {...props}
        />
    )
}

export { Synthetic }
