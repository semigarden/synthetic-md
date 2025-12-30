export default class Caret {
    private inlineId: string | null = null
    private blockId: string | null = null
    private offset: number | null = null
    private affinity?: 'start' | 'end'

    constructor(inlineId?: string, blockId?: string, offset?: number, affinity?: 'start' | 'end') {
        this.inlineId = inlineId ?? null
        this.blockId = blockId ?? null
        this.offset = offset ?? null
        this.affinity = affinity ?? undefined
    }

    setInlineId(inlineId: string) {
        this.inlineId = inlineId
    }

    setBlockId(blockId: string) {
        this.blockId = blockId
    }

    setOffset(offset: number) {
        this.offset = offset
    }

    setAffinity(affinity?: 'start' | 'end') {
        this.affinity = affinity
    }

    getInlineId() {
        return this.inlineId
    }

    getBlockId() {
        return this.blockId
    }
    
    getOffset() {
        return this.offset
    }

    getAffinity() {
        return this.affinity
    }
}
