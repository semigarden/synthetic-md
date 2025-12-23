type Inline =
    | Text
    | Emphasis
    | Strong
    | CodeSpan
    | Link
    | Image
    | Autolink
    | HTML
    | SoftBreak
    | HardBreak

interface Text {
    type: "Text"
    value: string
    rawText: string
    startIndex: number
    endIndex: number
}

interface Emphasis {
    type: "Emphasis"
    children: Inline[]
    rawText: string
    startIndex: number
    endIndex: number
}

interface Strong {
    type: "Strong"
    children: Inline[]
    rawText: string
    startIndex: number
    endIndex: number
}

interface CodeSpan {
    type: "CodeSpan"
    value: string
    rawText: string
    startIndex: number
    endIndex: number
}

interface Link {
    type: "Link"
    url: string
    title?: string
    children: Inline[]
    rawText: string
    startIndex: number
    endIndex: number
}

interface Image {
    type: "Image"
    url: string
    alt: string
    title?: string
    children: Inline[]
    rawText: string
    startIndex: number
    endIndex: number
}

interface SoftBreak {
    type: "SoftBreak"
    rawText: string
    startIndex: number
    endIndex: number
}

interface HardBreak {
    type: "HardBreak"
    rawText: string
    startIndex: number
    endIndex: number
}

interface Autolink {
    type: "Autolink"
    url: string
    rawText: string
    startIndex: number
    endIndex: number
}

interface HTML {
    type: "HTML"
    html: string
    rawText: string
    startIndex: number
    endIndex: number
}

export type {
    Inline,
    Text,
    Emphasis,
    Strong,
    CodeSpan,
    Link,
    Image,
    Autolink,
    HTML,
    SoftBreak,
    HardBreak,
}
