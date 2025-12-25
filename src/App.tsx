import Editor from '@/components/Editor'
import SyntheticText from './synthetic/S'
import { useState, useCallback, useEffect, useRef } from 'react'
import useStore from './hooks/useStore'



function App() {
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
  }, [loadText])

  useEffect(() => {
    if (hasLoadedRef.current) {
      saveText(text).catch((error) => console.error(error))
    }
  }, [text, saveText])

  const onChange = useCallback((e: React.ChangeEvent<HTMLDivElement>) => {
    setText(e.currentTarget.innerText)
  }, [])

  return (
    // <Editor />
    <SyntheticText value={text} onChange={onChange} />
  )
}

export default App
