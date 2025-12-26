import React from 'react'
import styles from '../styles/Synth.module.scss'

export type Caret = {
    offset: number
    anchor?: number
}

const Caret: React.FC<{ caret: Caret | null, text: string, onKeyDown?: (e: React.KeyboardEvent<HTMLSpanElement>) => void }> = ({ caret, text, onKeyDown }) => {
    if (!caret) return null;
    return (
      <>
        <span style={{ pointerEvents: 'none', userSelect: 'none' }} contentEditable={false} onKeyDown={onKeyDown}>{text.slice(0, caret.offset)}</span>
        <span className={styles.caret} style={{ pointerEvents: 'none', userSelect: 'none' }} contentEditable={false} onKeyDown={onKeyDown} />
        <span style={{ pointerEvents: 'none', userSelect: 'none' }} contentEditable={false} onKeyDown={onKeyDown}>{text.slice(caret.offset)}</span>
      </>
    )
}

export default Caret;
