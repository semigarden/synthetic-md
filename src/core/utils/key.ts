type Intent =
    | 'enter'
    | 'backspace'

const key: Record<string, Intent> = {
    'Enter': 'enter',
    'Backspace': 'backspace',
}

export { key, Intent }
