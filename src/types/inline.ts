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
    id: string
    type: "Text"
    value: string
    rawText: string
    pureText: string
    synthText: string
    startIndex: number
    endIndex: number
}

interface Emphasis {
    id: string
    type: "Emphasis"
    children: Inline[]
    rawText: string
    startIndex: number
    endIndex: number
}

interface Strong {
    id: string
    type: "Strong"
    children: Inline[]
    rawText: string
    startIndex: number
    endIndex: number
}

interface CodeSpan {
    id: string
    type: "CodeSpan"
    value: string
    rawText: string
    startIndex: number
    endIndex: number
}

interface Link {
    id: string
    type: "Link"
    url: string
    title?: string
    children: Inline[]
    rawText: string
    startIndex: number
    endIndex: number
}

interface Image {
    id: string
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
    id: string
    type: "SoftBreak"
    rawText: string
    startIndex: number
    endIndex: number
}

interface HardBreak {
    id: string
    type: "HardBreak"
    rawText: string
    startIndex: number
    endIndex: number
}

interface Autolink {
    id: string
    type: "Autolink"
    url: string
    rawText: string
    startIndex: number
    endIndex: number
}

interface HTML {
    id: string
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
