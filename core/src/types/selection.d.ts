export interface SelectionPoint {
    blockId: string
    inlineId: string
    position: number
    affinity?: 'start' | 'end'
}

export interface SelectionRange {
    start: SelectionPoint
    end: SelectionPoint
    direction: 'forward' | 'backward'
}
