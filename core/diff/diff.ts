import { Document, Block, Inline } from '../ast/types'

export type DiffType = 'add' | 'remove' | 'update' | 'none'

export interface BlockDiff {
    type: DiffType
    oldBlock?: Block
    newBlock?: Block
    index: number
    inlineDiffs?: InlineDiff[]
}

export interface InlineDiff {
    type: DiffType
    oldInline?: Inline
    newInline?: Inline
    index: number
    childDiffs?: InlineDiff[]
}

export interface AstDiff {
    blockDiffs: BlockDiff[]
    hasChanges: boolean
}

function blocksEqual(a: Block, b: Block): boolean {
    if (a.type !== b.type) return false
    if (a.text !== b.text) return false
    
    if (a.type === 'heading' && b.type === 'heading') {
        if (a.level !== b.level) return false
    }
    
    if (a.type === 'list' && b.type === 'list') {
        if (a.ordered !== b.ordered) return false
        if (a.tight !== b.tight) return false
    }
    
    if (a.type === 'codeBlock' && b.type === 'codeBlock') {
        if (a.language !== b.language) return false
        if (a.isFenced !== b.isFenced) return false
    }
    
    return true
}

function inlinesEqual(a: Inline, b: Inline): boolean {
    if (a.type !== b.type) return false
    if (a.text.symbolic !== b.text.symbolic) return false
    if (a.text.semantic !== b.text.semantic) return false
    
    if ('inlines' in a && 'inlines' in b) {
        const aInlines = a.inlines as Inline[]
        const bInlines = b.inlines as Inline[]
        if (aInlines.length !== bInlines.length) return false
        for (let i = 0; i < aInlines.length; i++) {
            if (!inlinesEqual(aInlines[i], bInlines[i])) return false
        }
    }
    
    return true
}

function diffInlines(oldInlines: Inline[], newInlines: Inline[]): InlineDiff[] {
    const diffs: InlineDiff[] = []
    
    const maxLen = Math.max(oldInlines.length, newInlines.length)
    
    const matchedOld = new Set<number>()
    const matchedNew = new Set<number>()
    
    for (let i = 0; i < newInlines.length; i++) {
        for (let j = 0; j < oldInlines.length; j++) {
            if (matchedOld.has(j)) continue
            if (inlinesEqual(oldInlines[j], newInlines[i])) {
                matchedOld.add(j)
                matchedNew.add(i)
                diffs.push({
                    type: 'none',
                    oldInline: oldInlines[j],
                    newInline: newInlines[i],
                    index: i,
                })
                break
            }
        }
    }
    
    for (let i = 0; i < newInlines.length; i++) {
        if (matchedNew.has(i)) continue
        for (let j = 0; j < oldInlines.length; j++) {
            if (matchedOld.has(j)) continue
            if (oldInlines[j].type === newInlines[i].type) {
                matchedOld.add(j)
                matchedNew.add(i)
                
                let childDiffs: InlineDiff[] | undefined
                if ('inlines' in oldInlines[j] && 'inlines' in newInlines[i]) {
                    childDiffs = diffInlines(
                        (oldInlines[j] as any).inlines,
                        (newInlines[i] as any).inlines
                    )
                }
                
                diffs.push({
                    type: 'update',
                    oldInline: oldInlines[j],
                    newInline: newInlines[i],
                    index: i,
                    childDiffs,
                })
                break
            }
        }
    }
    
    for (let i = 0; i < newInlines.length; i++) {
        if (!matchedNew.has(i)) {
            diffs.push({
                type: 'add',
                newInline: newInlines[i],
                index: i,
            })
        }
    }
    
    for (let j = 0; j < oldInlines.length; j++) {
        if (!matchedOld.has(j)) {
            diffs.push({
                type: 'remove',
                oldInline: oldInlines[j],
                index: j,
            })
        }
    }
    
    diffs.sort((a, b) => a.index - b.index)
    
    return diffs
}

function getInlineSignature(inline: Inline): string {
    let sig = `${inline.type}:${inline.text.symbolic}`
    if ('inlines' in inline) {
        sig += ':' + (inline.inlines as Inline[]).map(getInlineSignature).join(',')
    }
    return sig
}

function getBlockSignature(block: Block): string {
    let sig = `${block.type}:${block.text}`
    if (block.type === 'heading') {
        sig += `:${block.level}`
    }
    return sig
}

export function diffAst(oldAst: Document | null, newAst: Document): AstDiff {
    if (!oldAst) {
        return {
            blockDiffs: newAst.blocks.map((block, i) => ({
                type: 'add' as DiffType,
                newBlock: block,
                index: i,
                inlineDiffs: block.inlines.map((inline, j) => ({
                    type: 'add' as DiffType,
                    newInline: inline,
                    index: j,
                })),
            })),
            hasChanges: true,
        }
    }
    
    const blockDiffs: BlockDiff[] = []
    const oldBlocks = oldAst.blocks
    const newBlocks = newAst.blocks
    
    const matchedOld = new Set<number>()
    const matchedNew = new Set<number>()
    
    for (let i = 0; i < newBlocks.length; i++) {
        for (let j = 0; j < oldBlocks.length; j++) {
            if (matchedOld.has(j)) continue
            if (blocksEqual(oldBlocks[j], newBlocks[i])) {
                const inlineDiffs = diffInlines(oldBlocks[j].inlines, newBlocks[i].inlines)
                const inlinesChanged = inlineDiffs.some(d => d.type !== 'none')
                
                matchedOld.add(j)
                matchedNew.add(i)
                blockDiffs.push({
                    type: inlinesChanged ? 'update' : 'none',
                    oldBlock: oldBlocks[j],
                    newBlock: newBlocks[i],
                    index: i,
                    inlineDiffs: inlinesChanged ? inlineDiffs : undefined,
                })
                break
            }
        }
    }
    
    for (let i = 0; i < newBlocks.length; i++) {
        if (matchedNew.has(i)) continue
        
        for (let j = 0; j < oldBlocks.length; j++) {
            if (matchedOld.has(j)) continue
            if (oldBlocks[j].type === newBlocks[i].type) {
                matchedOld.add(j)
                matchedNew.add(i)
                
                const inlineDiffs = diffInlines(oldBlocks[j].inlines, newBlocks[i].inlines)
                
                blockDiffs.push({
                    type: 'update',
                    oldBlock: oldBlocks[j],
                    newBlock: newBlocks[i],
                    index: i,
                    inlineDiffs,
                })
                break
            }
        }
    }
    
    for (let i = 0; i < newBlocks.length; i++) {
        if (!matchedNew.has(i)) {
            blockDiffs.push({
                type: 'add',
                newBlock: newBlocks[i],
                index: i,
                inlineDiffs: newBlocks[i].inlines.map((inline, j) => ({
                    type: 'add' as DiffType,
                    newInline: inline,
                    index: j,
                })),
            })
        }
    }
    
    for (let j = 0; j < oldBlocks.length; j++) {
        if (!matchedOld.has(j)) {
            blockDiffs.push({
                type: 'remove',
                oldBlock: oldBlocks[j],
                index: j,
            })
        }
    }
    
    blockDiffs.sort((a, b) => a.index - b.index)
    
    const hasChanges = blockDiffs.some(d => d.type !== 'none')
    
    return { blockDiffs, hasChanges }
}

export function printDiff(diff: AstDiff): void {
    console.group('AST Diff')
    console.log('Has changes:', diff.hasChanges)
    
    for (const blockDiff of diff.blockDiffs) {
        const block = blockDiff.newBlock || blockDiff.oldBlock
        console.log(`${blockDiff.type} [${blockDiff.index}] ${block?.type}: "${block?.text.slice(0, 50)}..."`)
        
        if (blockDiff.inlineDiffs) {
            for (const inlineDiff of blockDiff.inlineDiffs) {
                const inline = inlineDiff.newInline || inlineDiff.oldInline
                console.log(`${inlineDiff.type} [${inlineDiff.index}] ${inline?.type}: "${inline?.text.symbolic.slice(0, 30)}"`)
            }
        }
    }
    
    console.groupEnd()
}

