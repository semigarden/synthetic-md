import InlineStream from '../inlineStream'
import { Inline } from '../../../../types'
import { uuid, decodeHTMLEntity } from '../../../../utils/utils'

class EntityResolver {
    public tryParse(
        stream: InlineStream,
        text: string,
        blockId: string,
        positionOffset: number
    ): Inline | null {
        if (stream.peek() !== '&') return null

        const start = stream.checkpoint()
        const remaining = stream.remaining()

        const match = remaining.match(
            /^&(?:#[xX][0-9a-fA-F]{1,6};|#\d{1,7};|[a-zA-Z][a-zA-Z0-9]{1,31};)/
        )

        if (!match) {
            stream.restore(start)
            return null
        }

        const raw = match[0]
        stream.consumeString(raw)

        return {
            id: uuid(),
            type: 'entity',
            blockId,
            text: {
                symbolic: raw,
                semantic: decodeHTMLEntity(raw),
            },
            position: {
                start: positionOffset + start,
                end: positionOffset + stream.position(),
            },
        } as Inline
    }
}

export default EntityResolver
