import type { AstApplyEffect, Block } from '../../../types'

class Effect {
    update(insert: AstApplyEffect['renderEffect']['render']['insert'], remove: Block[] = []): AstApplyEffect['renderEffect'] {
        return { type: 'update', render: { insert, remove } }
    }

    caret(blockId: string, inlineId: string, position: number, affinity: 'start' | 'end' = 'start'): AstApplyEffect['caretEffect'] {
        return { type: 'restore', caret: { blockId, inlineId, position, affinity } }
    }

    compose(renderEffect: AstApplyEffect['renderEffect'], caretEffect: AstApplyEffect['caretEffect']): AstApplyEffect {
        return { renderEffect, caretEffect }
    }

    updateCurrent(target: Block, current: Block, remove: Block[] = []) {
        return this.update([{ at: 'current', target, current }], remove)
    }
}

export default Effect
