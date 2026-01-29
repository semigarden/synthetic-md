import type { AstApplyEffect, Block, RenderDelete, RenderInsert, RenderInput } from '../../../types'

class Effect {
    update(insert: RenderInsert[], remove: Block[] = []): AstApplyEffect['renderEffect'] {
        return [{ type: 'update', render: { insert, remove } }]
    }

    input(input: RenderInput[]): AstApplyEffect['renderEffect'] {
        return [{ type: 'input', input }]
    }

    deleteBlock(deleteBlock: RenderDelete[]): AstApplyEffect['renderEffect'] {
        return [{ type: 'deleteBlock', deleteBlock }]
    }

    deleteInline(deleteInline: RenderDelete[]): AstApplyEffect['renderEffect'] {
        return [{ type: 'deleteInline', deleteInline }]
    }

    insertBlock(insertBlock: RenderInsert[]): AstApplyEffect['renderEffect'] {
        return [{ type: 'insertBlock', insertBlock }]
    }

    insertInline(insertInline: RenderInsert[]): AstApplyEffect['renderEffect'] {
        return [{ type: 'insertInline', insertInline }]
    }

    caret(blockId: string, inlineId: string, position: number, affinity: 'start' | 'end' = 'start'): AstApplyEffect['caretEffect'] {
        return { type: 'restore', caret: { blockId, inlineId, position, affinity } }
    }

    compose(renderEffect: AstApplyEffect['renderEffect'][], caretEffect: AstApplyEffect['caretEffect']): AstApplyEffect {
        return { renderEffect: renderEffect.flat() as AstApplyEffect['renderEffect'], caretEffect }
    }

    updateCurrent(target: Block, current: Block, remove: Block[] = []) {
        return this.update([{ type: 'block', at: 'current', target, current }], remove)
    }
}

export default Effect
