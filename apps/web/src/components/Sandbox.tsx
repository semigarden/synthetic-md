import { useEffect, useState } from 'react'
import { SyntheticText } from '@semigarden/synthetic-md-react'
import styles from '../styles/Sandbox.module.scss'
import { saveText, loadText } from '../utils'

const Sandbox = () => {
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
        <div className={styles.sandbox}>
            <SyntheticText className={styles.synthetic} value={text} onChange={onChange} />
        </div>
    )
}

export default Sandbox
