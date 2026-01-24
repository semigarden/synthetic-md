import InlineStream from '../inlineStream'
import { Inline } from '../../../../types'
import { uuid } from '../../../../utils/utils'

class CodeSpanResolver {
    public tryParse(
        stream: InlineStream,
        text: string,
        blockId: string,
        position: number
    ): Inline | null {
        const start = stream.checkpoint()

        if (stream.peek() !== '`') return null

        let ticks = 0
        while (stream.peek() === '`') {
            stream.next()
            ticks++
        }

        const contentStart = stream.position()

        while (!stream.end()) {
            if (stream.peek() === '`') {
                let count = 0
                const mark = stream.checkpoint()

                while (stream.peek() === '`') {
                    stream.next()
                    count++
                }

                if (count === ticks) {
                    const raw = text.slice(start, stream.position())
                    const content = text
                        .slice(contentStart, mark)
                        .replace(/\n/g, ' ')
                        .replace(/^ (.*) $/, '$1')

                    return {
                        id: uuid(),
                        type: 'codeSpan',
                        blockId,
                        text: {
                            symbolic: raw,
                            semantic: content,
                        },
                        position: {
                            start: position + start,
                            end: position + stream.position(),
                        },
                    }
                }

                stream.restore(mark)
            }

            stream.next()
        }

        stream.restore(start)
        return null
    }
}

export default CodeSpanResolver
