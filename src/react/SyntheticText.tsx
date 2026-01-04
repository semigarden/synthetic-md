import { useEffect } from 'react'
import { defineSyntheticText } from '../core'

type Props = {
    className?: string
    value: string
    onChange: (text: string) => void
}

const SyntheticText = ({ className, value, onChange }: Props) => {
    useEffect(() => {
        defineSyntheticText()
      }, [])

    return (
        <synthetic-text className={className} value={value} onChange={(e) => {
            onChange(e.nativeEvent.detail.value)
        }} />
    )
}

export default SyntheticText
