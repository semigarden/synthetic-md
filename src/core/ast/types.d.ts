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
    | Document
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
    | HTMLBlock
    | Footnote
    | TaskListItem
    | BlankLine

interface Document extends BlockType<'document'> {
    blocks: Block[]
}

interface Paragraph extends BlockType<'paragraph'> {
}

interface BlankLine extends BlockType<'blankLine'> {
}

interface Heading extends BlockType<'heading'> {
    level: number
}

interface BlockQuote extends BlockType<'blockQuote'> {
    blocks: Block[]
}

interface CodeBlock extends BlockType<'codeBlock'> {
    language?: string
    isFenced: boolean
    fence?: string
}

interface List extends BlockType<'list'> {
    ordered: boolean
    listStart?: number
    tight: boolean
    blocks: Block[]
}

interface ListItem extends BlockType<'listItem'> {
    checked?: boolean
    blocks: Block[]
}

interface ThematicBreak extends BlockType<'thematicBreak'> {
}

interface Table extends BlockType<'table'> {
    blocks: Block[]
}

interface TableRow extends BlockType<'tableRow'> {
    blocks: Block[]
}

interface TableCell extends BlockType<'tableCell'> {
    blocks: Block[]
}

interface HTMLBlock extends BlockType<'htmlBlock'> {
}

interface Footnote extends BlockType<'footnote'> {
    label: string
}

interface TaskListItem extends BlockType<'taskListItem'> {
    checked: boolean
    blocks: Block[]
}


interface InlineType<T extends string = string> {
    id: string
    blockId: string
    type: T
    text: {
        symbolic: string
        semantic: string
    }
    position: {
        start: number
        end: number
    }
}

export type Inline =
    | Text
    | Emphasis
    | Strong
    | CodeSpan
    | Link
    | Autolink
    | Image
    | Strikethrough
    | FootnoteRef
    | Emoji
    | SoftBreak
    | HardBreak
    | RawHTML
    | Entity

interface Text extends InlineType<'text'> {
}

interface Emphasis extends InlineType<'emphasis'> {
}

interface Strong extends InlineType<'strong'> {
}

interface CodeSpan extends InlineType<'codeSpan'> {
}

interface Link extends InlineType<'link'> {
    url: string
    title?: string
}

interface Autolink extends InlineType<'autolink'> {
    url: string
}

interface Image extends InlineType<'image'> {
    url: string
    alt: string
    title?: string
}

interface Strikethrough extends InlineType<'strikethrough'> {
}

interface FootnoteRef extends InlineType<'footnoteRef'> {
    label: string
}

interface Emoji extends InlineType<'emoji'> {
    name: string
}

interface SoftBreak extends InlineType<'softBreak'> {
}

interface HardBreak extends InlineType<'hardBreak'> {
}

interface RawHTML extends InlineType<'rawHTML'> {
}

interface Entity extends InlineType<'entity'> {
    decoded: string
}

interface DetectedBlock {
    type: Block["type"];
    level?: number;
    ordered?: boolean;
    listStart?: number;
    language?: string;
    fence?: string;
    checked?: boolean;
    label?: string;
}

interface ParseState {
    inFencedCodeBlock: boolean;
    codeBlockFence: string;
    codeBlockId: string;
}

// Link reference definitions for reference-style links
interface LinkReference {
    url: string;
    title?: string;
}

// Delimiter for emphasis processing
interface Delimiter {
    type: '*' | '_' | '~';
    length: number;
    position: number;
    canOpen: boolean;
    canClose: boolean;
    active: boolean;
}
