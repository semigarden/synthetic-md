import { useState, useEffect } from 'react'
import Sandbox from './Sandbox'
import Guide from './Guide'
// import Documentation from './Documentation'
import styles from '../styles/App.module.scss'
import guide from '../assets/guide.svg'
import sandbox from '../assets/sandbox.svg'
import github from '../assets/github.svg'
import sun from '../assets/sun.svg'
import moon from '../assets/moon.svg'

const App = ({ tab = 'guide' }: { tab?: 'guide' | 'sandbox' }) => {
    const [activeTab, setActiveTab] = useState<'guide' | 'sandbox'>(tab)
    const [theme, setTheme] = useState('dark')

    useEffect(() => {
        const syncFromUrl = () => {
            const path = window.location.pathname

            switch (path) {
                case '/synthetic-md/sandbox':
                    go('sandbox')
                    break
                case '/synthetic-md/guide':
                default:
                    go('guide')
                    break
            }
        }

        syncFromUrl()

        window.addEventListener('popstate', syncFromUrl)
        return () => window.removeEventListener('popstate', syncFromUrl)
    }, [])

    function go(tab: 'guide' | 'sandbox') {
        setActiveTab(tab)

        const url =
          tab === 'sandbox'
            ? '/synthetic-md/sandbox'
            : '/synthetic-md/guide'

        document.title = `synthetic-md - ${tab === 'sandbox' ? 'Sandbox' : 'Guide'}`
      
        history.pushState({}, '', url)
    }

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme)
        document.documentElement.style.colorScheme = theme
        document.documentElement.style.backgroundColor = theme === 'dark' ? '#000' : '#fff'
        document.documentElement.style.color = theme === 'dark' ? '#fff' : '#000'
    }, [theme])

    return (
        <div className={styles.app}>
            <div className={styles.panel}>
                <div className={`${styles.title} ${activeTab === 'guide' && styles.active}`} onClick={() => go('guide')}>
                    <img className={styles.icon} src={guide} alt="guide" /> Guide
                </div>
                <div className={`${styles.title} ${activeTab === 'sandbox' && styles.active}`} onClick={() => go('sandbox')}>
                    <img className={styles.icon} src={sandbox} alt="sandbox" /> Sandbox
                </div>
                <div className={`${styles.title}`} onClick={() => window.open('https://github.com/semigarden/synthetic-md#readme', '_blank')}>
                    <img className={styles.icon} src={github} alt="github" /> GitHub
                </div>
                <div className={`${styles.title} ${styles.theme}`} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                    <img className={`${styles.icon} ${styles.theme}`} src={theme === 'light' ? moon : sun} alt="theme" /> {theme === 'light' ? 'Dark' : 'Light'}
                </div>
                {/* <div className={`${styles.title} ${activeTab === 'documentation' && styles.active}`} onClick={() => setActiveTab('documentation')}>
                    Documentation
                </div> */}
            </div>
            <div className={styles.tabs}>
                <div className={styles.activeTab}>
                    <Guide active={activeTab === 'guide'} theme={theme} />
                    <Sandbox active={activeTab === 'sandbox'} />
                    {/* <Documentation active={activeTab === 'documentation'} /> */}
                </div>
            </div>
        </div>
    )
}

export default App
