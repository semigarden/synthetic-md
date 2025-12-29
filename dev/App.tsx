import React, { useEffect, useState } from 'react'
import Component from './Component'
import { loadText, saveText } from './db'

const App = () => {
  const [value, setValue] = useState('')

  // load once
  useEffect(() => {
    loadText().then(setValue)
  }, [])

  const handleChange = (v: string) => {
    setValue(v)
    saveText(v)
  }

  return (
    <Component text={value} onChange={handleChange} />
  )
}

export default App
