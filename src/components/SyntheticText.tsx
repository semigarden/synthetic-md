import React, { useRef, useEffect, useCallback } from "react"
// import { useMarkdownEditor } from "../hooks/useMarkdownEditor"
import styles from "../styles/SyntheticText.module.scss"
import type { SyntheticTextProps } from "../types"
import type { VNode } from "../types/node"
import type { Block } from "../types/block"
import type { Inline } from "../types/inline"
import { uuid } from "../utils"

import { parseBlock } from "../parse/parseBlock"

type Perspective = {
    cursor: number | null
    vision: "pure" | "synthetic"
}

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
    const lastUpdateTimeRef = useRef(0)
    const debounceTimeoutRef = useRef<number | null>(null)
    const markdownText = value !== undefined ? value : text
    const markdownRef = useRef(markdownText)
    markdownRef.current = markdownText

    const ast = parseBlock(markdownText)

    // console.log("ast", JSON.stringify(ast, null, 2))

    const prevVNodeRef = useRef<VNode[]>([])
    const visionRef = useRef<Perspective>({ cursor: null, vision: "synthetic" })
    const justTypedRef = useRef(false)
    
    const focusedRangeRef = useRef<{ start: number; end: number } | null>(null)

    const getCursorOffset = useCallback((root: HTMLElement): number | null => {
        const sel = window.getSelection()
        if (!sel || sel.rangeCount === 0) return null
        const range = sel.getRangeAt(0)
        
        let node: Node | null = range.startContainer
        if (node.nodeType === Node.TEXT_NODE) {
            node = node.parentElement
        }
        
        while (node && node !== root) {
            const el = node as HTMLElement
            if (el.dataset?.start !== undefined) {
                return Number(el.dataset.start) + range.startOffset
            }
            node = node.parentElement
        }
        return null
    }, [])

    const createElement = useCallback((node: VNode): HTMLElement | Text => {
        if (node.type === '#text') {
            return document.createTextNode(node.text || '')
        }
        
        const el = document.createElement(node.type)
        if (node.id) el.id = node.id
        if (node.startIndex !== undefined) el.dataset.start = node.startIndex.toString()
        if (node.endIndex !== undefined) el.dataset.end = node.endIndex.toString()
        
        if (node.children) {
            for (const child of node.children) {
                el.appendChild(createElement(child))
            }
        }
        
        if (node.text && (!node.children || node.children.length === 0)) {
            el.textContent = node.text
        }
        
        return el
    }, [])

    const renderInlineVNode = useCallback((inline: Inline, perspective: Perspective): VNode => {
        const isFocused = perspective.cursor !== null && 
            perspective.cursor >= inline.startIndex && 
            perspective.cursor <= inline.endIndex

        switch (inline.type) {
            case "Text":
                return {
                    type: "span",
                    id: inline.id,
                    text: inline.value,
                    children: [],
                    startIndex: inline.startIndex,
                    endIndex: inline.endIndex,
                    focus: isFocused,
                }

            case "Strong":
                if (isFocused) {
                    return {
                        type: "span",
                        id: inline.id,
                        text: inline.rawText,
                        children: [],
                        startIndex: inline.startIndex,
                        endIndex: inline.endIndex,
                        focus: true,
                    }
                }
                return {
                    type: "strong",
                    id: inline.id,
                    children: inline.children.map(child => renderInlineVNode(child, perspective)),
                    startIndex: inline.startIndex,
                    endIndex: inline.endIndex,
                    focus: false,
                }

            case "Emphasis":
                if (isFocused) {
                    return {
                        type: "span",
                        id: inline.id,
                        text: inline.rawText,
                        children: [],
                        startIndex: inline.startIndex,
                        endIndex: inline.endIndex,
                        focus: true,
                    }
                }
                return {
                    type: "em",
                    id: inline.id,
                    children: inline.children.map(child => renderInlineVNode(child, perspective)),
                    startIndex: inline.startIndex,
                    endIndex: inline.endIndex,
                    focus: false,
                }

            case "CodeSpan":
                if (isFocused) {
                    return {
                        type: "span",
                        id: inline.id,
                        text: inline.rawText,
                        children: [],
                        startIndex: inline.startIndex,
                        endIndex: inline.endIndex,
                        focus: true,
                    }
                }
                return {
                    type: "code",
                    id: inline.id,
                    text: inline.value,
                    children: [],
                    startIndex: inline.startIndex,
                    endIndex: inline.endIndex,
                    focus: false,
                }

            case "Link":
                if (isFocused) {
                    return {
                        type: "span",
                        id: inline.id,
                        text: inline.rawText,
                        children: [],
                        startIndex: inline.startIndex,
                        endIndex: inline.endIndex,
                        focus: true,
                    }
                }
                return {
                    type: "a",
                    id: inline.id,
                    props: { href: inline.url, title: inline.title },
                    children: inline.children.map(child => renderInlineVNode(child, perspective)),
                    startIndex: inline.startIndex,
                    endIndex: inline.endIndex,
                    focus: false,
                }

            case "SoftBreak":
                return {
                    type: "#text",
                    id: inline.id,
                    text: " ",
                    children: [],
                    startIndex: inline.startIndex,
                    endIndex: inline.endIndex,
                }

            case "HardBreak":
                return {
                    type: "br",
                    id: inline.id,
                    children: [],
                    startIndex: inline.startIndex,
                    endIndex: inline.endIndex,
                }

            default:
                return {
                    type: "span",
                    id: (inline as any).id || uuid(),
                    text: (inline as any).rawText || "",
                    children: [],
                    startIndex: inline.startIndex,
                    endIndex: inline.endIndex,
                }
        }
    }, [])

    const renderBlockVNode = useCallback((block: Block, perspective: Perspective): VNode => {
        const base: VNode = {
            type: "div",
            id: block.id,
            children: [],
            startIndex: block.startIndex,
            endIndex: block.endIndex,
        }

        switch (block.type) {
            case "document":
                base.type = "div"
                base.children = block.children.map(child => renderBlockVNode(child, perspective))
                break

            case "paragraph":
                base.type = "p"
                base.children = block.children.map(child => renderInlineVNode(child, perspective))
                break

            case "heading":
                base.type = perspective.vision === "synthetic" ? `h${block.level}` : "span"
                base.children = block.children.map(child => renderInlineVNode(child, perspective))
                break

            case "codeBlock":
                base.type = "pre"
                base.children = [{
                    type: "code",
                    id: `${block.id}-code`,
                    text: block.code,
                    children: [],
                    startIndex: block.startIndex,
                    endIndex: block.endIndex,
                }]
                break

            case "lineBreak":
                base.type = "br"
                break

            case "thematicBreak":
                base.type = "hr"
                break

            case "list":
                base.type = block.ordered ? "ol" : "ul"
                base.children = block.children.map(child => renderBlockVNode(child, perspective))
                break

            case "listItem":
                base.type = "li"
                base.children = block.children.map(child => renderBlockVNode(child, perspective))
                break

            case "blockQuote":
                base.type = "blockquote"
                base.children = block.children.map(child => renderBlockVNode(child, perspective))
                break

            case "htmlBlock":
                base.type = "div"
                base.text = block.html
                break

            default:
                base.type = "span"
        }

        return base
    }, [renderInlineVNode])

    const updateDOM = useCallback((parent: HTMLElement, prev: VNode[], next: VNode[]) => {
        const maxLen = Math.max(prev.length, next.length)
        
        for (let i = 0; i < maxLen; i++) {
            const newNode = next[i]
            const oldNode = prev[i]
            const domNode = parent.childNodes[i] as HTMLElement | undefined

            if (!newNode && domNode) {
                parent.removeChild(domNode)
                continue
            }

            if (!oldNode && newNode) {
                parent.appendChild(createElement(newNode))
                continue
            }

            if (!domNode) continue

            const needsReplace = 
                newNode.type !== oldNode.type ||
                newNode.id !== oldNode.id ||
                newNode.text !== oldNode.text ||
                newNode.focus !== oldNode.focus

            if (needsReplace) {
                const newEl = createElement(newNode)
                parent.replaceChild(newEl, domNode)
            } else if (newNode.children && oldNode.children) {
                updateDOM(domNode, oldNode.children, newNode.children)
            }
        }
    }, [createElement])

    useEffect(() => {
        if (!divRef.current) return
        
        if (isEditingRef.current) {
            const nextVNodes = ast.children.map(b => renderBlockVNode(b as Block, visionRef.current))
            prevVNodeRef.current = nextVNodes
            return
        }
        
        const nextVNodes = ast.children.map(b => renderBlockVNode(b as Block, visionRef.current))
        divRef.current.innerHTML = ""
        nextVNodes.forEach(v => divRef.current!.appendChild(createElement(v) as Node))
        prevVNodeRef.current = nextVNodes
    }, [ast, renderBlockVNode, createElement])

    const getEditedElementText = useCallback((): { text: string; start: number; end: number } | null => {
        if (!divRef.current) return null
        
        const sel = window.getSelection()
        if (!sel || sel.rangeCount === 0) return null
        
        let node: Node | null = sel.anchorNode
        if (node?.nodeType === Node.TEXT_NODE) {
            node = node.parentElement
        }
        
        while (node && node !== divRef.current) {
            const el = node as HTMLElement
            if (el.dataset?.start !== undefined && el.dataset?.end !== undefined) {
                return {
                    text: el.textContent || "",
                    start: Number(el.dataset.start),
                    end: Number(el.dataset.end),
                }
            }
            node = node.parentElement
        }
        return null
    }, [])

    const handleInput = useCallback((e: React.FormEvent<HTMLDivElement>) => {
        if (!divRef.current) return
        
        justTypedRef.current = true
        
        const edited = getEditedElementText()
        
        if (edited) {
            const { start, end } = focusedRangeRef.current || { start: edited.start, end: edited.end }
            
            const safeStart = Math.max(0, Math.min(start, markdownRef.current.length))
            const safeEnd = Math.max(safeStart, Math.min(end, markdownRef.current.length))
            
            const newMarkdown = 
                markdownRef.current.slice(0, safeStart) + 
                edited.text + 
                markdownRef.current.slice(safeEnd)
            
            focusedRangeRef.current = { start: safeStart, end: safeStart + edited.text.length }
            
            markdownRef.current = newMarkdown
            
            const syntheticEvent = {
                ...e,
                target: { ...e.currentTarget, value: newMarkdown },
                currentTarget: { ...e.currentTarget, value: newMarkdown },
            } as React.ChangeEvent<HTMLDivElement>
            // console.log("syntheticEvent 1", syntheticEvent)
            onChange?.(syntheticEvent)
        } else {
            const plainText = divRef.current.innerText || ""
            markdownRef.current = plainText
            const syntheticEvent = {
                ...e,
                target: { ...e.currentTarget, value: plainText },
                currentTarget: { ...e.currentTarget, value: plainText },
            } as React.ChangeEvent<HTMLDivElement>
            // console.log("syntheticEvent 2", syntheticEvent)
            onChange?.(syntheticEvent)
        }

        
    }, [onChange, getEditedElementText])

    const handleFocus = useCallback(() => {
        isEditingRef.current = true
    }, [])

    const handleBlur = useCallback(() => {
        isEditingRef.current = false
        visionRef.current = { cursor: null, vision: "synthetic" }
        focusedRangeRef.current = null
        
        if (debounceTimeoutRef.current !== null) {
            clearTimeout(debounceTimeoutRef.current)
            debounceTimeoutRef.current = null
        }
        
        if (divRef.current) {
            lastUpdateTimeRef.current = Date.now()
            const nextVNodes = ast.children.map(b => renderBlockVNode(b as Block, visionRef.current))
            updateDOM(divRef.current, prevVNodeRef.current, nextVNodes)
            prevVNodeRef.current = nextVNodes
        }
        
        onBlur?.()
    }, [ast, onBlur, renderBlockVNode, updateDOM])

    const onSelectionChange = useCallback(() => {
        if (!divRef.current) return
        
        const now = Date.now()
        if (now - lastUpdateTimeRef.current < 50) {
            return
        }
        
        const sel = window.getSelection()
        if (!sel || sel.rangeCount === 0) return
        if (!divRef.current.contains(sel.anchorNode)) return

        if (debounceTimeoutRef.current !== null) {
            clearTimeout(debounceTimeoutRef.current)
        }
        
        debounceTimeoutRef.current = window.setTimeout(() => {
            if (!divRef.current) return
            
            if (justTypedRef.current) {
                justTypedRef.current = false
                visionRef.current.cursor = getCursorOffset(divRef.current)
                return
            }
            
            const newCursor = getCursorOffset(divRef.current)
            
            if (newCursor === visionRef.current.cursor) return
            
            visionRef.current.cursor = newCursor
            lastUpdateTimeRef.current = Date.now()
            
            if (!isEditingRef.current) {
                const edited = getEditedElementText()
                if (edited) {
                    focusedRangeRef.current = { start: edited.start, end: edited.end }
                } else {
                    focusedRangeRef.current = null
                }
            }
            
            const nextVNodes = ast.children.map(b => renderBlockVNode(b as Block, visionRef.current))
            updateDOM(divRef.current, prevVNodeRef.current, nextVNodes)
            prevVNodeRef.current = nextVNodes
        }, 10)
    }, [ast, getCursorOffset, renderBlockVNode, updateDOM, getEditedElementText])

    useEffect(() => {
        document.addEventListener("selectionchange", onSelectionChange)
        return () => {
            document.removeEventListener("selectionchange", onSelectionChange)
            if (debounceTimeoutRef.current !== null) {
                clearTimeout(debounceTimeoutRef.current)
            }
        }
    }, [onSelectionChange])

    useEffect(() => {
        if (!divRef.current) return
        const container = divRef.current
        
        const onClick = (e: MouseEvent) => {
            if (e.target === container) {
                visionRef.current = { cursor: null, vision: "synthetic" }
                
                lastUpdateTimeRef.current = Date.now()
                const nextVNodes = ast.children.map(b => renderBlockVNode(b as Block, visionRef.current))
                updateDOM(container, prevVNodeRef.current, nextVNodes)
                prevVNodeRef.current = nextVNodes
            }
        }
        
        container.addEventListener("click", onClick)
        return () => container.removeEventListener("click", onClick)
    }, [ast, renderBlockVNode, updateDOM])

    return (
        <div
            ref={divRef}
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

export { SyntheticText }
