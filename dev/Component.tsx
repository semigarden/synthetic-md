type Props = {
    text: string
    onChange: (text: string) => void
}

const Component = ({ text, onChange }: Props) => {
    return (
        <synthetic-text value={text} onChange={(e) => {
            onChange(e.nativeEvent.detail.value)
        }} />
    )
}

export default Component
