import type { Inline } from './inline'

interface BlockType<T extends string = string> {
    id: string
    type: T
    text: string
    position: {
        start: number
        end: number
    }
    inlines: Inline[]
}

export type Block =
    | Paragraph
    | Heading
    | BlockQuote
    | CodeBlock
    | List
    | ListItem
    | ThematicBreak
    | Table
    | TableRow
    | TableCell
    | TableHeader
    | HTMLBlock
    | Footnote
    | TaskListItem
    | BlankLine

export interface Paragraph extends BlockType<'paragraph'> {
}

export interface BlankLine extends BlockType<'blankLine'> {
}

export interface Heading extends BlockType<'heading'> {
    level: number
}

export interface BlockQuote extends BlockType<'blockQuote'> {
    blocks: Block[]
}

export interface CodeBlock extends BlockType<'codeBlock'> {
    language?: string
    isFenced: boolean
    fenceChar?: '`' | '~'
    fenceLength?: number
    openIndent?: number
    close?: string
}

export interface List extends BlockType<'list'> {
    ordered: boolean
    listStart?: number
    tight: boolean
    blocks: Block[]
}

export interface ListItem extends BlockType<'listItem'> {
    blocks: Block[]
}

export interface ThematicBreak extends BlockType<'thematicBreak'> {
}

export interface Table extends BlockType<'table'> {
    blocks: Block[]
}

export interface TableRow extends BlockType<'tableRow'> {
    blocks: Block[]
}

export interface TableCell extends BlockType<'tableCell'> {
    blocks: Block[]
}

export interface TableHeader extends BlockType<'tableHeader'> {
    blocks: Block[]
}

export interface HTMLBlock extends BlockType<'htmlBlock'> {
}

export interface Footnote extends BlockType<'footnote'> {
    label: string
}

export interface TaskListItem extends BlockType<'taskListItem'> {
    checked: boolean
    blocks: Block[]
}
