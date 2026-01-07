import InlineStream from '../inlineStream'
import LinkReferenceState from '../../linkReferenceState'
import { parseLinkDestination } from '../parseLinkDestination'
import { Inline } from '../../../../types'
import { uuid } from '../../../../utils/utils'

class LinkResolver {
    constructor(private linkReferences: LinkReferenceState) {}

    public tryParse(
        stream: InlineStream,
        blockId: string,
        position: number
    ): Inline | null {
        const start = stream.checkpoint()

        if (!stream.consume('[')) return null

        const textStart = stream.position()
        while (!stream.end() && stream.peek() !== ']') {
            stream.next()
        }

        if (!stream.consume(']')) {
            stream.restore(start)
            return null
        }

        const label = stream.slice(textStart, stream.position() - 1)

        const dest = parseLinkDestination(stream)
        if (!dest) {
            stream.restore(start)
            return null
        }

        const reference = this.linkReferences.get(label)
        if (!reference) return null

        return {
            id: uuid(),
            type: 'link',
            blockId,
            text: {
                symbolic: stream.slice(start, stream.position()),
                semantic: label,
            },
            position: {
                start: position + start,
                end: position + stream.position(),
            },
            url: reference.url,
            title: reference.title,
        } as Inline
    }
}

export default LinkResolver
