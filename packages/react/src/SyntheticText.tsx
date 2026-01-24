import { useEffect, forwardRef } from 'react'
import { defineElement } from '@semigarden/synthetic-md'

type Props = {
    ref?: React.RefObject<HTMLTextAreaElement>
    className?: string
    value: string
    onChange: (e: Event) => void
}

const SyntheticText = forwardRef<HTMLTextAreaElement, Props>(({ className, value, onChange }, ref) => {
    useEffect(() => {
        defineElement()
    }, [])

    return (
        <synthetic-text ref={ref} className={className} value={value} onChange={onChange} />
    )
})

export default SyntheticText
