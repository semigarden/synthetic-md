import React, { useEffect, useRef, useState } from "react"
import styles from "../styles/Editor.module.scss"
import useStore from "../hooks/useStore"
import { useMarkdownEditor } from "../oldHooks/useMarkdownEditor"

const Editor: React.FC = () => {
  const { loadText, saveText } = useStore()
  const { render } = useMarkdownEditor()
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
  }, [loadText])

  useEffect(() => {
    if (hasLoadedRef.current) {
      saveText(text).catch((error) => console.error(error))
    }
  }, [text, saveText])

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
        dangerouslySetInnerHTML={{ __html: render(text, { cursor: 0, vision: "synthetic" }) }}
      />
    </div>
  )
}

export default Editor
