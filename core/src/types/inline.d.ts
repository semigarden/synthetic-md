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
    | Marker
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

export type Marker = InlineType<'marker'>
export type Text = InlineType<'text'>
export type Emphasis = InlineType<'emphasis'>
export type Strong = InlineType<'strong'>
export type CodeSpan = InlineType<'codeSpan'>
export type Strikethrough = InlineType<'strikethrough'>
export type SoftBreak = InlineType<'softBreak'>
export type HardBreak = InlineType<'hardBreak'>
export type RawHTML = InlineType<'rawHTML'>
export interface Image extends InlineType<'image'> {
    url: string
    alt: string
    title?: string
}
export interface Link extends InlineType<'link'> {
    url: string
    title?: string
}
export interface Autolink extends InlineType<'autolink'> {
    url: string
}
export interface FootnoteRef extends InlineType<'footnoteRef'> {
    label: string
}
export interface Emoji extends InlineType<'emoji'> {
    name: string
}
export interface Entity extends InlineType<'entity'> {
    decoded: string
}
