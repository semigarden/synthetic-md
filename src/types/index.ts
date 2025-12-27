
import type { Inline } from "./inline"


interface LinkReference {
    url: string
    title?: string
}

interface Delimiter {
    type: "*" | "_"
    length: number
    pos: number
    canOpen: boolean
    canClose: boolean
    node?: Inline
}

interface DocumentWithRefs extends Document {
    __linkReferences?: Map<string, LinkReference>
  }

export type { LinkReference, Delimiter, DocumentWithRefs }
