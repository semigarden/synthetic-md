import { useState } from 'react'
import Sandbox from './components/Sandbox'
import Guide from './components/Guide'
import Documentation from './components/Documentation'
import styles from './styles/App.module.scss'

const App = () => {
    const [activeTab, setActiveTab] = useState('guide')

    return (
        <div className={styles.app}>
            <div className={styles.panel}>
                <div className={`${styles.title} ${activeTab === 'sandbox' && styles.active}`} onClick={() => setActiveTab('sandbox')}>
                    Sandbox
                </div>
                <div className={`${styles.title} ${activeTab === 'guide' && styles.active}`} onClick={() => setActiveTab('guide')}>
                    Guide
                </div>
                <div className={`${styles.title} ${activeTab === 'documentation' && styles.active}`} onClick={() => setActiveTab('documentation')}>
                    Documentation
                </div>
            </div>
            <div className={styles.tabs}>
                {activeTab === 'sandbox' && <Sandbox />}
                {activeTab === 'guide' && <Guide />}
                {activeTab === 'documentation' && <Documentation />}
            </div>
        </div>
    )
}

export default App
