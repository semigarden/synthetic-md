interface InlineBase {
    id: string
    type: string
    rawText: string
    startIndex: number
    endIndex: number
}

interface Text extends InlineBase {
    type: "Text"
    value: string
    pureText: string
    synthText: string
}

interface CodeSpan extends InlineBase {
    type: "CodeSpan"
    value: string
}

interface Emphasis extends InlineBase {
    type: "Emphasis"
    children: Inline[]
    delimiter: "*" | "_"
}

interface Strong extends InlineBase {
    type: "Strong"
    children: Inline[]
    delimiter: "**" | "__"
}

interface Link extends InlineBase {
    type: "Link"
    url: string
    title?: string
    children: Inline[]
}

interface Image extends InlineBase {
    type: "Image"
    url: string
    alt: string
    title?: string
}

interface Autolink extends InlineBase {
    type: "Autolink"
    url: string
}

interface HTML extends InlineBase {
    type: "HTML"
    html: string
}

interface HardBreak extends InlineBase {
    type: "HardBreak"
}

interface SoftBreak extends InlineBase {
    type: "SoftBreak"
}

interface Entity extends InlineBase {
    type: "Entity"
    decoded: string
}

interface Strikethrough extends InlineBase {
    type: "Strikethrough"
    children: Inline[]
}

interface FootnoteRef extends InlineBase {
    type: "FootnoteRef"
    label: string
}

interface Emoji extends InlineBase {
    type: "Emoji"
    name: string
}

type Inline =
    | Text
    | CodeSpan
    | Emphasis
    | Strong
    | Link
    | Image
    | Autolink
    | HTML
    | HardBreak
    | SoftBreak
    | Entity
    | Strikethrough
    | FootnoteRef
    | Emoji

export type {
    InlineBase,
    Inline,
    Text,
    CodeSpan,
    Emphasis,
    Strong,
    Link,
    Image,
    Autolink,
    HTML,
    HardBreak,
    SoftBreak,
    Entity,
    Strikethrough,
    FootnoteRef,
    Emoji,
}
