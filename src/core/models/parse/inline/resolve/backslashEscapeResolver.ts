import InlineStream from '../inlineStream'
import { Inline } from '../../../../types'
import { uuid } from '../../../../utils/utils'

class BackslashEscapeResolver {
    public tryParse(
        stream: InlineStream,
        blockId: string,
        positionOffset: number
    ): Inline | null {
        if (!stream.consume('\\')) return null

        const start = stream.position() - 1
        const next = stream.peek()

        if (!next) return null

        stream.next()

        return {
            id: uuid(),
            type: 'text',
            blockId,
            text: {
                symbolic: '\\' + next,
                semantic: next,
            },
            position: {
                start: positionOffset + start,
                end: positionOffset + stream.position(),
            },
        }
    }
}

export default BackslashEscapeResolver
