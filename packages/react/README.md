# Synthetic Markdown

A UI primitive for unified Markdown editing and rendering

---

```
import { useState } from 'react'
import { SyntheticText } from '@semigarden/synthetic-md-react'

const App = () => {
    const [text, setText] = useState('')
    const onChange = (e: Event) => {
        const text = (e.target as HTMLTextAreaElement).value
        setText(text)
    }
    return <SyntheticText className={styles.synthetic} value={text} onChange={onChange} />
}
```
