import React, { useRef, useEffect } from 'react'
import styles from '../styles/components/SyntheticText.module.scss'
import { parseBlock, renderBlock } from '../utils/parser'

const SyntheticText: React.FC<{ 
  className?: string,
  text: string, 
  onChange?: (e: React.ChangeEvent<HTMLDivElement>) => void, 
  value?: string,
  onBlur?: () => void,
  props?: React.HTMLAttributes<HTMLDivElement>
}> = ({ className, text, onChange, value, onBlur, props }) => {
  const divRef = useRef<HTMLDivElement>(null)
  const isEditingRef = useRef(false)
  const lastTextRef = useRef<string | null>(null)
  const markdownText = value !== undefined ? value : text

  useEffect(() => {
    if (divRef.current && !isEditingRef.current) {
      const document = parseBlock(markdownText || '')
      const html = renderBlock(document)
  
      divRef.current.innerHTML = html
    }
  }, [markdownText])

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    if (divRef.current) {
      const plainText = divRef.current.innerText || divRef.current.textContent || ''
      lastTextRef.current = plainText

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

  const innerTextRef = useRef<string>('')

  const handleBlur = () => {
    if (divRef.current) {
      const document = parseBlock(markdownText || '')
      const html = renderBlock(document)
  
      innerTextRef.current = markdownText
      divRef.current.innerHTML = html
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
export default SyntheticText
