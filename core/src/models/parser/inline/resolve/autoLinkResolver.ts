import InlineStream from '../inlineStream'
import { Inline } from '../../../../types'
import { uuid } from '../../../../utils/utils'

class AutoLinkResolver {
    public tryParse(
        stream: InlineStream,
        blockId: string,
        position: number
    ): Inline | null {
        const start = stream.checkpoint()

        if (!stream.consume('<')) return null

        const textStart = stream.position()
        while (!stream.end() && stream.peek() !== '>') {
            stream.next()
        }

        if (!stream.consume('>')) {
            stream.restore(start)
            return null
        }

        const url = stream.slice(textStart, stream.position() - 1)

        return {
            id: uuid(),
            type: 'autolink',
            blockId,
            text: {
                symbolic: stream.slice(start, stream.position()),
                semantic: url,
            },
            position: {
                start: position + start,
                end: position + stream.position(),
            },
            url,
        } as Inline
    }
}

export default AutoLinkResolver
