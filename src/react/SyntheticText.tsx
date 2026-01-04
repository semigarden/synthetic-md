import { useEffect } from 'react'
import { defineSyntheticText } from '../core'

type Props = {
    ref?: (el: HTMLTextAreaElement) => void
    className?: string
    value: string
    onChange: (e: Event) => void
}

const SyntheticText = ({ ref, className, value, onChange }: Props) => {
    useEffect(() => {
        defineSyntheticText()
    }, [])

    return (
        <synthetic-text ref={(el: HTMLTextAreaElement) => ref?.(el)} className={className} value={value} onChange={onChange} />
    )
}

export default SyntheticText
