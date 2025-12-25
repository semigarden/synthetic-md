import React, { useRef, useLayoutEffect, useCallback, useState } from "react"
import styles from "../styles/SyntheticText.module.scss"

type TextBuffer = {
    text: string
    selection: {
        start: number,
        end: number,
    }
}

interface Block {
    type: "document" | "paragraph" | "heading" | "block-quote" | "list" | "list-item" | "code-block" | "thematic-break" | "html-block" | "line-break"
    text: string
    start: number
    end: number
}

const Synthetic: React.FC<{
    className?: string
    value?: string
    onChange?: (e: React.ChangeEvent<HTMLDivElement>) => void
  }> = ({ className = "", value = "", onChange }) => {
    const [, forceRender] = useState(0)
    
    const activeRef = useRef<HTMLDivElement | null>(null)
    const lastActiveStartRef = useRef<number | null>(null)
  
    const bufferRef = useRef<TextBuffer>({
      text: value,
      selection: { start: 0, end: 0 },
    })

    if (bufferRef.current.text !== value) {
      bufferRef.current.text = value
    }


    const blocks = parseBlocks(bufferRef.current.text)


    const activeIndex = findActiveBlock(
      blocks,
      bufferRef.current.selection.start
    )
  
    const activeBlock = blocks[activeIndex]

    useLayoutEffect(() => {
        if (!activeRef.current || !activeBlock) return
      
        const el = activeRef.current
      
        if (lastActiveStartRef.current !== activeBlock.start) {
          el.innerText = activeBlock.text
          lastActiveStartRef.current = activeBlock.start
          

          const range = document.createRange()
          range.selectNodeContents(el)
          range.collapse(true)
          
          const sel = window.getSelection()
          sel?.removeAllRanges()
          sel?.addRange(range)
        }
      }, [activeBlock])
  
    const onBlockInput = useCallback((e: React.FormEvent<HTMLDivElement>) => {
      if (!activeRef.current || !activeBlock) return
  
      const newText = activeRef.current.innerText
  
      const before = bufferRef.current.text.slice(0, activeBlock.start)
      const after = bufferRef.current.text.slice(activeBlock.end)
  
      bufferRef.current.text = before + newText + after
  
      const cursor = activeBlock.start + newText.length
      bufferRef.current.selection = { start: cursor, end: cursor }
  
        onChange?.({
            ...e,
            target: { ...e.currentTarget, value: bufferRef.current.text },
            currentTarget: { ...e.currentTarget, value: bufferRef.current.text },
        } as React.ChangeEvent<HTMLDivElement>)
    }, [activeBlock, onChange])

    const getSelectionRange = useCallback((root: HTMLElement): { start: number; end: number } | null => {
        const sel = window.getSelection()
        if (!sel || sel.rangeCount === 0) return null
        
        const range = sel.getRangeAt(0)
        
        if (!root.contains(range.commonAncestorContainer)) {
            return null
        }
        
        const getAbsoluteOffset = (container: Node, offset: number): number => {
            let node: Node | null = container
            let blockEl: HTMLElement | null = null
            
            while (node && node !== root) {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    const el = node as HTMLElement
                    if (el.dataset?.start !== undefined) {
                        blockEl = el
                        break
                    }
                }
                node = node.parentNode
            }
            
            if (!blockEl) return 0
            
            const blockStart = Number(blockEl.dataset.start) || 0
            
            const measureRange = document.createRange()
            
            try {
                const walker = document.createTreeWalker(
                    blockEl,
                    NodeFilter.SHOW_TEXT,
                    null
                )
                
                const firstText = walker.nextNode()
                
                if (!firstText) {
                    return blockStart
                }
                
                measureRange.setStart(firstText, 0)
                
                if (container.nodeType === Node.TEXT_NODE) {
                    measureRange.setEnd(container, offset)
                } else {
                    const el = container as HTMLElement
                    if (offset === 0) {
                        measureRange.setEnd(container, 0)
                    } else if (offset <= el.childNodes.length) {
                        if (offset < el.childNodes.length) {
                            measureRange.setEndBefore(el.childNodes[offset])
                        } else {
                            measureRange.setEnd(container, offset)
                        }
                    } else {
                        measureRange.setEnd(container, el.childNodes.length)
                    }
                }
                
                const textBefore = measureRange.toString().length
                
                return blockStart + textBefore
            } catch (e) {
                return blockStart
            }
        }
        
        const start = getAbsoluteOffset(range.startContainer, range.startOffset)
        const end = getAbsoluteOffset(range.endContainer, range.endOffset)
        
        return { start, end }
    }, [])

    const containerRef = useRef<HTMLDivElement | null>(null)
    const selectionTimeoutRef = useRef<number | null>(null)

    const onSelect = useCallback(() => {
        if (!containerRef.current) return
        
        if (selectionTimeoutRef.current !== null) {
            clearTimeout(selectionTimeoutRef.current)
        }
        
        selectionTimeoutRef.current = window.setTimeout(() => {
            if (!containerRef.current) return
            
            const selection = getSelectionRange(containerRef.current)

            if (selection !== null) {
                const current = bufferRef.current.selection
                if (current.start !== selection.start || current.end !== selection.end) {
                    bufferRef.current.selection = selection
                    forceRender(x => x + 1)
                }
            }
        }, 10)
    }, [getSelectionRange])

    useLayoutEffect(() => {
        document.addEventListener("selectionchange", onSelect)
        return () => {
            document.removeEventListener("selectionchange", onSelect)
            if (selectionTimeoutRef.current !== null) {
                clearTimeout(selectionTimeoutRef.current)
            }
        }
    }, [onSelect])
  
    return (
      <div 
        ref={containerRef}
        className={`${styles.syntheticText} ${className}`} 
        style={{ fontFamily: "monospace" }}
      >
        {blocks.map((block, i) => {
          if (i === activeIndex) {
            return (
              <div
                key={block.start}
                ref={activeRef}
                contentEditable
                suppressContentEditableWarning
                onInput={onBlockInput}
                style={{ whiteSpace: "pre-wrap", outline: "none" }}
                data-start={block.start}
                data-end={block.end}
              >
                {block.text}
              </div>
            )
          }
  
          return (
            <div
              key={block.start}
              onMouseDown={(e) => {
                e.preventDefault()
              
                bufferRef.current.selection = {
                  start: block.start,
                  end: block.start,
                }
              
                forceRender(x => x + 1)
              }}
              data-start={block.start}
              data-end={block.end}
            >
              {renderInline(block.text)}
            </div>
          )
        })}
      </div>
    )
  }

export { Synthetic }

function parseBlocks(text: string): Block[] {
    const lines = text.split("\n")
    const blocks: Block[] = []

    let offset = 0
  
    for (const line of lines) {
      const lineStart = offset
      const lineEnd = offset + line.length
  
      let type: Block["type"] = "paragraph"
  
      if (line.startsWith("# ")) {
        type = "heading"
      } else if (line.startsWith("> ")) {
        type = "block-quote"
      } else if (line.startsWith("- ")) {
        type = "list-item"
      } else if (line.trim() === "") {
        type = "line-break"
      }
  
      blocks.push({
        type,
        text: line,
        start: lineStart,
        end: lineEnd,
      })
  
      offset = lineEnd + 1
    }
  
    return blocks
  }

  function findActiveBlock(
    blocks: Block[],
    cursor: number
  ): number {
    return blocks.findIndex(
      b => cursor >= b.start && cursor <= b.end
    )
  }

  function renderInline(text: string): React.ReactNode[] {
    const result: React.ReactNode[] = []
    let i = 0
  
    while (i < text.length) {
      if (text[i] === "*" && text[i + 1] === "*") {
        const end = text.indexOf("**", i + 2)
        if (end !== -1) {
          result.push(
            <strong key={i}>
              {text.slice(i + 2, end)}
            </strong>
          )
          i = end + 2
          continue
        }
      }
  
      result.push(text[i])
      i++
    }
  
    return result
  }

  

function readSelection(root: HTMLElement): { start: number; end: number } {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) {
      return { start: 0, end: 0 }
    }
  
    const range = sel.getRangeAt(0)
  
    const preStart = range.cloneRange()
    preStart.selectNodeContents(root)
    preStart.setEnd(range.startContainer, range.startOffset)
  
    const start = preStart.toString().length
    const end = start + range.toString().length
  
    return { start, end }
  }
  
function restoreSelection(
    root: HTMLElement,
    start: number,
    end: number
) {
    const range = document.createRange()
    const sel = window.getSelection()
    if (!sel) return
  
    let charIndex = 0
    let startNode: Node | null = null
    let startOffset = 0
    let endNode: Node | null = null
    let endOffset = 0
  
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  
    while (walker.nextNode()) {
      const node = walker.currentNode as Text
      const nextCharIndex = charIndex + node.length
  
      if (!startNode && start <= nextCharIndex) {
        startNode = node
        startOffset = start - charIndex
      }
  
      if (!endNode && end <= nextCharIndex) {
        endNode = node
        endOffset = end - charIndex
        break
      }
  
      charIndex = nextCharIndex
    }
  
    if (!startNode || !endNode) return
  
    range.setStart(startNode, startOffset)
    range.setEnd(endNode, endOffset)
  
    sel.removeAllRanges()
    sel.addRange(range)
}
  