// import { useEffect, useState } from 'react'
// import { loadText, saveText } from './db.ts'
// import SyntheticText from './react/SyntheticText'

// const App = () => {
//   const [value, setValue] = useState('')

//   useEffect(() => {
//     loadText().then(setValue)
//   }, [])

//   const handleChange = (v: string) => {
//     setValue(v)
//     saveText(v)
//   }

//   return (
//     <SyntheticText value={value} onChange={handleChange} />
//   )
// }

// export default App
