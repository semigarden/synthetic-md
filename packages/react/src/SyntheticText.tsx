import { useEffect, forwardRef, useRef } from 'react'
import { defineElement } from '@semigarden/synthetic-md'

type Props = {
    ref?: React.RefObject<HTMLTextAreaElement | null>
    className?: string
    value?: string
    onChange: (e: Event) => void
    autofocus?: boolean
}

const SyntheticText = forwardRef(({ className, value = '', onChange, autofocus = false }: Props, ref) => {
    const elementRef = useRef<HTMLElement>(null)

    useEffect(() => {
        defineElement()
    }, [])

    return (
        <synthetic-text 
            ref={(node: HTMLElement | null) => {
                elementRef.current = node
                if (typeof ref === 'function') {
                    ref(node)
                } else if (ref) {
                    (ref as React.MutableRefObject<HTMLElement | null>).current = node
                }
            }} 
            className={className} 
            value={value} 
            onChange={onChange}
            autofocus={autofocus}
        />
    )
})

export default SyntheticText
