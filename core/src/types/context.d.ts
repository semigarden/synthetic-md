import type { Block } from './block'
import type { Inline } from './inline'

export type EditContext = {
    block: Block
    inline: Inline
    inlineIndex: number
    inlineElement: HTMLElement
}

export type ParseBlockContext = {
    isFencedCodeBlock: boolean
    codeBlockFence: string
    codeBlockIndent: number
    currentCodeBlock: Block | null
    codeBlockLineCount: number

    table?: {
        start: number
        headerLine: string
        dividerLine?: string
        rows: string[]
    }
}
