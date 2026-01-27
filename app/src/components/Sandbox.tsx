import { useEffect, useState } from 'react'
import { SyntheticText } from '@semigarden/synthetic-md-react'
import styles from '../styles/Sandbox.module.scss'
import { saveText, loadText } from '../utils'


const Sandbox = ({ className = '', active = false }: { className?: string, active?: boolean }) => {
    const [text, setText] = useState('')
    
    useEffect(() => {
        loadText().then(text => {
            setText(text)
        })
    }, [])

    const onChange = (e: Event) => {
        const text = (e.target as HTMLTextAreaElement).value
        setText(text)
        saveText(text)
    }

    return (
        <div className={`${styles.sandbox} ${active && styles.active} ${className}`}>
            <SyntheticText className={styles.synthetic} value={text} onChange={onChange} autofocus={true} />
        </div>
    )
}

export default Sandbox
