import Editor from '@/components/Editor'
import { Synthetic } from './synthetic/Synthetic'
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
    console.log(e.target.value)
    setText(e.target.value)
  }, [])

  return (
    // <Editor />
    <Synthetic text={text} onChange={onChange} value={text} />
  )
}

export default App
