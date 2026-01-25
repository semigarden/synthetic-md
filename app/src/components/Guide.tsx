import { useState } from 'react'
import styles from '../styles/Guide.module.scss'

const Guide = ({ className = '', active = false }: { className?: string, active?: boolean }) => {
    const [installTab, setInstallTab] = useState('vanilla')
    const [usageTab, setUsageTab] = useState('vanilla')
    const [copiedKey, setCopiedKey] = useState<string | null>(null)

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
            <p>This project is still in development. Interactions with the following blocks are not yet fully implemented:
                <ul>
                    <li>Tables</li>
                    <li>Task Lists</li>
                    <li>Code Blocks</li>
                </ul>
            </p>
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
                        {/* <span className={styles.language}>bash</span> */}
                        <pre>
                            <code>
                                npm install @semigarden/synthetic-md
                            </code>
                        </pre>
                    </div>}
                    {installTab === 'react' && <div className={styles.content}>
                        <button className={styles.button} onClick={() => copy('install-react', 'npm install @semigarden/synthetic-md-react')}>{copiedKey === 'install-react' && 'Copied' || 'Copy'}</button>
                        {/* <span className={styles.language}>bash</span> */}
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
                    {usageTab === 'vanilla' && <div className={styles.content}>
                        <button className={styles.button} onClick={() => copy('usage-vanilla', `import { defineElement } from '@semigarden/synthetic-md'

defineElement()

const syntheticElement = document.querySelector<any>('#synthetic')

syntheticElement.addClasses(['synthetic'])

syntheticElement.addEventListener('change', (e) => {
    const text = e.target.value
    console.log(text)
})

syntheticElement.value = '# Hello'`)}>{copiedKey === 'usage-vanilla' && 'Copied' || 'Copy'}</button>
                        {/* <span className={styles.language}>js</span> */}
                        <pre>
                            <code>
                                <span>{`import { defineElement } from '@semigarden/synthetic-md'`}</span>
                                <br/>
                                <br/>
                                <span>{`defineElement()`}</span>
                                <br/>
                                <br/>
                                <span>{`const syntheticElement = document.querySelector<any>('#synthetic')`}</span>
                                <br/>
                                <br/>
                                <span>{`syntheticElement.addClasses(['synthetic'])`}</span>
                                <br/>
                                <br/>
                                <span>{`syntheticElement.addEventListener('change', (e) => {`}</span>
                                <br/>
                                <span>{`    const text = e.target.value`}</span>
                                <br/>
                                <span>{`    console.log(text)`}</span>
                                <br/>
                                <span>{`})`}</span>
                                <br/>
                                <br/>
                                <span>{`syntheticElement.value = '${'# Hello'}'`}</span>
                            </code>
                        </pre>
                    </div>}
                    {usageTab === 'react' && <div className={styles.content}>
                        <button className={styles.button} onClick={() => copy('usage-react', `import { useState } from 'react'
import { SyntheticText } from '@semigarden/synthetic-md-react'

const App = () => {
    const [text, setText] = useState('')
    const onChange = (e: Event) => {
        const text = (e.target as HTMLTextAreaElement).value
        setText(text)
    }
    return <SyntheticText className={styles.synthetic} value={text} onChange={onChange} />
}`)}>{copiedKey === 'usage-react' && 'Copied' || 'Copy'}</button>
                        {/* <span className={styles.language}>tsx</span> */}
                        <pre>
                            <code>
                                <span>{`import { useState } from 'react'`}</span>
                                <br/>
                                <span>{`import { SyntheticText } from '@semigarden/synthetic-md-react'`}</span>
                                <br/>
                                <br/>
                                <span>{`const App = () => {`}</span>
                                <br/>
                                <span>{`    const [text, setText] = useState('')`}</span>
                                <br/>
                                <br/>
                                <span>{`    const onChange = (e: Event) => {`}</span>
                                <br/>
                                <span>{`        const text = (e.target as HTMLTextAreaElement).value`}</span>
                                <br/>
                                <span>{`        setText(text)`}</span>
                                <br/>
                                <span>{`    }`}</span>
                                <br/>
                                <br/>
                                <span>{`    return <SyntheticText className={styles.synthetic} value={text} onChange={onChange} />`}</span>
                                <br/>
                                <span>{`}`}</span>
                            </code>
                        </pre>
                    </div>}
                </div>
            </div>
        </div>
    )
}

export default Guide
