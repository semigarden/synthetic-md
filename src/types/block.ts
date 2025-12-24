import type { Inline } from './inline'

interface ContainerBlock<T extends string = string> {
  type: T
  children: Block[]
}

interface ContainerInline<T extends string = string> {
  type: T
  children: Inline[]
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

interface Document extends ContainerBlock<'document'> {
  id: string
  type: 'document'
  startIndex: number
  endIndex: number
  children: Block[]
}

interface Paragraph extends ContainerInline<'paragraph'> {
  id: string
  type: 'paragraph'
  rawText: string
  startIndex: number
  endIndex: number
}

interface Heading extends ContainerInline<'heading'> {
  id: string
  type: 'heading'
  level: number
  rawText: string
  pureText: string
  synthText: string
  startIndex: number
  endIndex: number
}

interface BlockQuote extends ContainerBlock<'blockQuote'> {
  id: string
  rawText: string
  startIndex: number
  endIndex: number
}

interface List extends ContainerBlock<'list'> {
  id: string
  ordered: boolean
  start?: number
  tight?: boolean
  rawText: string
  startIndex: number
  endIndex: number
}

interface ListItem extends ContainerBlock<'listItem'> {
  id: string
  checked?: boolean
  rawText: string
  startIndex: number
  endIndex: number
}

interface CodeBlock extends ContainerInline<'codeBlock'> {
  id: string
  type: 'codeBlock'
  language: string
  code: string
  rawText: string
  startIndex: number
  endIndex: number
}

interface ThematicBreak {
  id: string
  type: 'thematicBreak'
  children: Block[]
  rawText: string
  startIndex: number
  endIndex: number
}

interface HTMLBlock {
  id: string
  type: 'htmlBlock'
  children: Block[]
  html: string
  rawText: string
  startIndex: number
  endIndex: number
}

interface LineBreak {
  id: string
  type: 'lineBreak'
  children: Block[]
  rawText: string
  startIndex: number
  endIndex: number
}

export type {
  ContainerBlock,
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
