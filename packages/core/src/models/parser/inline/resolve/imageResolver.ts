import InlineStream from '../inlineStream'
import { parseLinkDestination } from '../parseLinkDestination'
import { Inline } from '../../../../types'
import { uuid } from '../../../../utils/utils'

class ImageResolver {
    public tryParse(
        stream: InlineStream,
        blockId: string,
        position: number
    ): Inline | null {
        const start = stream.checkpoint()

        if (!stream.consume('!')) return null
        if (!stream.consume('[')) {
            stream.restore(start)
            return null
        }

        const altStart = stream.position()
        while (!stream.end() && stream.peek() !== ']') {
            stream.next()
        }

        if (!stream.consume(']')) {
            stream.restore(start)
            return null
        }

        const alt = stream.slice(altStart, stream.position() - 1)

        const dest = parseLinkDestination(stream)
        if (!dest) {
            stream.restore(start)
            return null
        }

        return {
            id: uuid(),
            type: 'image',
            blockId,
            text: {
                symbolic: stream.slice(start, stream.position()),
                semantic: alt,
            },
            position: {
                start: position + start,
                end: position + stream.position(),
            },
            url: dest.url,
            title: dest.title,
            alt,
        } as Inline
    }
}

export default ImageResolver
