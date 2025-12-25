import Editor from '@/components/Editor'
import { Synth } from './synthetic/Synth'
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

  const onChange = useCallback((e: any) => {
    setText(e.target.value)
  }, [])

  return (
    // <Editor />
    <Synth value={text} onChange={onChange} />
  )
}

export default App
