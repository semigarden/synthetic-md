import React, { useEffect, useRef, useState } from 'react'
import styles from '@/styles/components/Editor.module.scss'
import { parseBlock, renderBlock } from '@/utils/parser'
import useStore from '@/hooks/useStore'

const Editor: React.FC = () => {
  const { loadText, saveText } = useStore()
  const [text, setText] = useState('')
  const hasLoadedRef = useRef(false)

  useEffect(() => {
    let cancelled = false

    loadText()
      .then((value) => {
        if (!cancelled) {
          setText(value)
          hasLoadedRef.current = true
        }
      })
      .catch((error) => console.error(error))

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (hasLoadedRef.current) {
      saveText(text).catch((error) => console.error(error))
    }
  }, [text])

  const document = parseBlock(text)

  return (
    <div className={styles.editor}>
      <textarea
        className={styles.text}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={20}
        autoFocus={true}
      />
      <div
        className={styles.preview}
        dangerouslySetInnerHTML={{ __html: renderBlock(document) }}
      />
    </div>
  )
}

export default Editor
