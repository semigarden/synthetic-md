# Synthetic Markdown

Synthetic Markdown is a UI primitive for editing and rendering Markdown in a unified interface, removing the need for split panes. The core is framework-agnostic and has zero runtime dependencies.

> [!NOTE]
> The project is designed as a building block rather than a complete editor application

> [!TIP]
> Try it online: <https://semigarden.github.io/synthetic-md/>
> 
---

![Synthetic Markdown](apps/web/public/synth.gif)

---

## Installation

#### Vanilla
```
npm install @semigarden/synthetic-md
```

#### React
```
npm install @semigarden/synthetic-md-react
```

## Usage

#### Vanilla
```js
import { defineElement } from '@semigarden/synthetic-md'

defineElement()

const syntheticElement = document.querySelector<any>('#synthetic')

syntheticElement.addClasses(['synthetic'])

syntheticElement.addEventListener('change', (e) => {
    const text = e.target.value
    console.log(text)
})

syntheticElement.value = 'Hello, world!'
```

#### React
```tsx
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
