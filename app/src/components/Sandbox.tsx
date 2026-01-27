import { useRef, useEffect, useState } from 'react'
import { SyntheticText } from '@semigarden/synthetic-md-react'
import styles from '../styles/Sandbox.module.scss'
import { saveText, loadText } from '../utils'


const Sandbox = ({ className = '', active = false }: { className?: string, active?: boolean }) => {
    const syntheticRef = useRef<HTMLTextAreaElement | null>(null)
    const [autofocus, setAutofocus] = useState(active)
    const [text, setText] = useState('')
    
    useEffect(() => {
        loadText().then(text => {
            setText(text)
        })
    }, [])

    useEffect(() => {
        setAutofocus(active)
    }, [active])

    const onChange = (e: Event) => {
        const text = (e.target as HTMLTextAreaElement).value
        setText(text)
        saveText(text)
    }

    return (
        <div className={`${styles.sandbox} ${active && styles.active} ${className}`}>
            <SyntheticText ref={syntheticRef} className={styles.synthetic} value={text} onChange={onChange} autofocus={autofocus} />
        </div>
    )
}

export default Sandbox
