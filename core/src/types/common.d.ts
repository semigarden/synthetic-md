import type { Block } from './block'
import type { Inline } from './inline'

export interface DetectedBlock {
    type: Block['type']
    level?: number
    ordered?: boolean
    listStart?: number
    language?: string
    fence?: string
    checked?: boolean
    label?: string
}

export interface LinkReference {
    url: string
    title?: string
}

export interface Delimiter {
    type: '*' | '_' | '~'
    length: number
    position: number
    canOpen: boolean
    canClose: boolean
    active: boolean
}

export type FlatBlockEntry = {
    block: Block
    parent: Block | null
    index: number
}

export type FlatInlineEntry = {
    inline: Inline
    block: Block
    index: number
}

export interface OpenBlock {
    block: Block
    type: Block['type']
    indent: number
    marker?: string
}

export interface Caret {
    blockId: string
    inlineId: string
    position: number
    affinity?: 'start' | 'end'
}

export interface TimelineEvent {
    text: string
    blocks: Block[]
    caret: Caret
}

export type RenderPosition = 'current' | 'previous' | 'next'

export type Intent =
    | 'split'
    | 'merge'
    | 'indent'
    | 'outdent'
    | 'insertRowAbove'
    | 'splitInCell'
    | 'undo'
    | 'redo'
    | 'toggleTask'
    | 'exitCodeBlockAbove'
    | 'exitCodeBlockBelow'

export type InputEvent = {
    text: string
    type: string
}
