import { createRoot } from 'react-dom/client'
import '../src/styles/index.scss'
// ⬇️ This simulates: import 'synthetic-text'
import '../core/element'

import App from './App'

const root = createRoot(document.getElementById('root')!)
root.render(<App />)
