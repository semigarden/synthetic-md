import { useEffect, useState } from 'react'
import { loadText, saveText } from './db'
import SyntheticText from './react/SyntheticText'
import './styles/index.scss'

const App = () => {
    const [value, setValue] = useState('')

    useEffect(() => {
        loadText().then(setValue)
    }, [])

    const onChange = (e: Event) => {
        const target = e.target as HTMLTextAreaElement
        const v = target.value
        setValue(v)
        saveText(v)
    }

    return (
        <SyntheticText className="syntheticText" value={value} onChange={onChange} />
    )
}

export default App
