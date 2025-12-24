interface VNode {
    id?: string
    type: string
    children: VNode[]
    text?: string
    props?: Record<string, any>
    focus?: boolean
    startIndex?: number
    endIndex?: number
}

export type { VNode }
