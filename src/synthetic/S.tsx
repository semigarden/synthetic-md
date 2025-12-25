import React, { useState } from 'react'
import styles from '../styles/SyntheticText.module.scss'

const SyntheticText: React.FC<{
    className?: string;
    value: string;
    onChange?: (e: React.ChangeEvent<HTMLDivElement>) => void;
}> = ({
    className = "",
    value,
    onChange = () => {},
}) => {
    const [text, setText] = useState(value)

    return (
        <div className={`${styles.syntheticText} ${className}`}
        >
            {text}
        </div>
    )
}

export default SyntheticText
