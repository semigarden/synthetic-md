import { useState, useEffect } from 'react'
import { createHighlighter } from 'shiki'
import styles from '../styles/Guide.module.scss'

const usageVanilla = `import { defineElement } from '@semigarden/synthetic-md'

defineElement()

const syntheticElement = document.querySelector('#synthetic')

syntheticElement.addClasses(['synthetic'])

syntheticElement.addEventListener('change', (e) => {
    const text = e.target.value
    console.log(text)
})

syntheticElement.value = '# Hello'`

const usageReact = `import { useState } from 'react'
import { SyntheticText } from '@semigarden/synthetic-md-react'

const App = () => {
    const [text, setText] = useState('')
    const onChange = (e: Event) => {
        const text = (e.target as HTMLTextAreaElement).value
        setText(text)
    }
    return <SyntheticText className={styles.synthetic} value={text} onChange={onChange} />
}`

const Guide = ({ className = '', active = false, theme = 'dark' }: { className?: string, active?: boolean, theme?: string }) => {
    const [installTab, setInstallTab] = useState('vanilla')
    const [usageTab, setUsageTab] = useState('vanilla')
    const [copiedKey, setCopiedKey] = useState<string | null>(null)
    const [html, setHtml] = useState('')

    useEffect(() => {
        let cancelled = false

        const code = usageTab === 'react' ? usageReact : usageVanilla
        const lang = usageTab === 'react' ? 'tsx' : 'js';

        (async () => {
            const highlighter = await createHighlighter({
                themes: ['tokyo-night', 'min-light'],
                langs: usageTab === 'react' ? ['tsx'] : ['js'],
            })
        
            const codeTheme =
                theme === 'dark'
                ? 'tokyo-night'
                : 'min-light'
        
            const out = highlighter.codeToHtml(code, { lang, theme: codeTheme })
        
            if (!cancelled) setHtml(out)
        })()
    
        return () => {
            cancelled = true
        }
    }, [usageTab, theme])

    const copy = (key: string, text: string) => {
        setCopiedKey(key)
        navigator.clipboard.writeText(text)
        setTimeout(() => {
            setCopiedKey(null)
        }, 1000)
    }

    return (
        <div className={`${styles.guide} ${active && styles.active} ${className}`}>
            <h2>Overview</h2>
            <p>Synthetic Markdown is a lightweight editor built as a primitive UI element.
                It behaves like a textarea while rendering in real time on a unified editing surface, removing the need for split views or mode switching.
                Its core is framework-agnostic and currently available for Vanilla JS and React, with a minimal controlled API.
            </p>
            <hr/>
            <h2>Status</h2>
            <div>This project is still in development. Interactions with the following blocks are not yet fully implemented:
                <ul>
                    <li>Tables</li>
                    <li>Task Lists</li>
                    <li>Code Blocks</li>
                </ul>
            </div>
            <hr/>
            <h2>Try It Online</h2>
            <p>Visit the sandbox page and start typing to explore supported <a href="https://www.markdownguide.org/" target="_blank">Markdown</a> syntax.
            </p>
            <hr/>
            <h2>Installation</h2>
            <div className={styles.code}>
                <div className={styles.tabs}>
                    <div className={`${styles.title} ${installTab === 'vanilla' && styles.active}`} onClick={() => setInstallTab('vanilla')}>Vanilla</div>
                    <div className={`${styles.title} ${installTab === 'react' && styles.active}`} onClick={() => setInstallTab('react')}>React</div>
                </div>
                <div className={styles.blocks}>
                    {installTab === 'vanilla' && <div className={styles.content}>
                        <button className={styles.button} onClick={() => copy('install-vanilla', 'npm install @semigarden/synthetic-md')}>{copiedKey === 'install-vanilla' && 'Copied' || 'Copy'}</button>
                        <span className={styles.language}>bash</span>
                        <pre>
                            <code>
                                npm install @semigarden/synthetic-md
                            </code>
                        </pre>
                    </div>}
                    {installTab === 'react' && <div className={styles.content}>
                        <button className={styles.button} onClick={() => copy('install-react', 'npm install @semigarden/synthetic-md-react')}>{copiedKey === 'install-react' && 'Copied' || 'Copy'}</button>
                        <span className={styles.language}>bash</span>
                        <pre>
                            <code>
                                npm install @semigarden/synthetic-md-react
                            </code>
                        </pre>
                    </div>}
                    
                </div>
            </div>
            <p/>
            <hr/>
            <h2>Usage</h2>
            <div className={styles.code}>
                <div className={styles.tabs}>
                    <div className={`${styles.title} ${usageTab === 'vanilla' && styles.active}`} onClick={() => setUsageTab('vanilla')}>Vanilla</div>
                    <div className={`${styles.title} ${usageTab === 'react' && styles.active}`} onClick={() => setUsageTab('react')}>React</div>
                </div>
                <div className={styles.blocks}>
                    <div className={styles.content}>
                        <button className={styles.button} onClick={() => {
                            if (usageTab === 'vanilla') copy('usage-vanilla', usageVanilla)
                            else copy('usage-react', usageReact)
                        }}>{copiedKey === 'usage-vanilla' && 'Copied' || 'Copy'}</button>
                        <span className={styles.language}>{usageTab === 'vanilla' ? 'ts' : 'tsx'}</span>
                        <code className={styles.code} dangerouslySetInnerHTML={{ __html: html }} />
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Guide
