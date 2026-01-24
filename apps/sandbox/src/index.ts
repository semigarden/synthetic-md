import './style.scss'
import { defineElement } from '@semigarden/synthetic-md'

defineElement()

const syntheticElement = document.querySelector<any>('#synthetic')

// syntheticElement.value = `# Synthetic Markdown

// - [x] core linked
// - [ ] tables
// - [ ] code blocks

// > event
// `

const DB_NAME = 'synthetic-md'
const STORE = 'documents'
const KEY = 'text'

export async function loadText(): Promise<string> {
    return new Promise((res) => {
        const open = indexedDB.open(DB_NAME, 1)

        open.onupgradeneeded = () => {
            open.result.createObjectStore(STORE)
        }

        open.onsuccess = () => {
            const db = open.result
            const tx = db.transaction(STORE, 'readonly')
            const store = tx.objectStore(STORE)
            const req = store.get(KEY)
            req.onsuccess = () => res(req.result ?? '')
        }
    })
}

export async function saveText(text: string) {
    const open = indexedDB.open(DB_NAME, 1)

    open.onsuccess = () => {
        const db = open.result
        const tx = db.transaction(STORE, 'readwrite')
        tx.objectStore(STORE).put(text, KEY)
    }
}

loadText().then(text => {
    if (syntheticElement && syntheticElement instanceof HTMLElement) {
        (syntheticElement as any).value = text
    }
})

syntheticElement.addEventListener('change', () => {
    saveText(syntheticElement.value)
})
