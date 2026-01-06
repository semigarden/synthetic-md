import { Intent } from "../types"

const onKey: Record<string, Intent> = {
    'Enter': 'split',
    'Backspace': 'merge',
}

export { onKey }
