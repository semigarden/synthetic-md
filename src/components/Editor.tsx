import React, { useState } from 'react'
import styles from '@/styles/components/Editor.module.scss'
import { parseBlock, renderBlock } from '@/utils/parser'

const Editor: React.FC = () => {
  const [text, setText] = useState('')

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
