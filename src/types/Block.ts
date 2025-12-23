import type { Inline } from '@/types/Inline'

export interface ContainerBlock<T extends string = string> {
  type: T
  children: Block[]
}

type Block =
  | Document
  | Paragraph
  | Heading
  | BlockQuote
  | List
  | ListItem
  | CodeBlock
  | ThematicBreak
  | HTMLBlock
  | LineBreak

interface Document extends ContainerBlock<'document'> {}

interface Paragraph {
  type: 'paragraph'
  rawText: string
  startIndex: number
  endIndex: number
  children: Inline[]
}

interface Heading {
  type: 'heading'
  level: number
  rawText: string
  startIndex: number
  endIndex: number
  children: Inline[]
}

interface BlockQuote extends ContainerBlock<'blockQuote'> {
  rawText: string
  startIndex: number
  endIndex: number
}

interface List extends ContainerBlock<'list'> {
  ordered: boolean
  start?: number
  tight?: boolean
  rawText: string
  startIndex: number
  endIndex: number
}

interface ListItem extends ContainerBlock<'listItem'> {
  checked?: boolean
  rawText: string
  startIndex: number
  endIndex: number
}

interface CodeBlock {
  type: 'codeBlock'
  language: string
  code: string
  rawText: string
  startIndex: number
  endIndex: number
}

interface ThematicBreak {
  type: 'thematicBreak'
  rawText: string
  startIndex: number
  endIndex: number
}

interface HTMLBlock {
  type: 'htmlBlock'
  html: string
  rawText: string
  startIndex: number
  endIndex: number
}

interface LineBreak {
  type: 'lineBreak'
  rawText: string
  startIndex: number
  endIndex: number
}

export type {
  Block,
  Document,
  Paragraph,
  Heading,
  BlockQuote,
  List,
  ListItem,
  CodeBlock,
  ThematicBreak,
  HTMLBlock,
  LineBreak,
}
