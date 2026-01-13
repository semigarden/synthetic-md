import InlineStream from '../inlineStream'
import { Inline, Delimiter } from '../../../../types'
import { uuid } from '../../../../utils/utils'

class DelimiterResolver {
    public tryParse(
        stream: InlineStream,
        blockId: string,
        positionOffset: number,
        result: Inline[],
        delimiterStack: Delimiter[]
    ): boolean {
        const ch = stream.peek()
        if (ch !== '*' && ch !== '_' && ch !== '~') return false

        const start = stream.position()
        const char = stream.next()!
        let count = 1

        while (stream.peek() === char) {
            stream.next()
            count++
        }

        const inlinePos = result.length

        result.push({
            id: uuid(),
            type: 'text',
            blockId,
            text: {
                symbolic: char.repeat(count),
                semantic: char.repeat(count),
            },
            position: {
                start: positionOffset + start,
                end: positionOffset + stream.position(),
            },
        })

        delimiterStack.push({
            type: char,
            length: count,
            position: inlinePos,
            canOpen: true,
            canClose: true,
            active: true,
        } as Delimiter)

        return true
    }
}

export default DelimiterResolver
