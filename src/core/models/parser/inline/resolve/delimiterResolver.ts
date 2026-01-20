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
        const char = stream.peek()
        if (char !== '*' && char !== '_' && char !== '~') return false

        const start = stream.position()

        const prevChar = stream.peekBack() ?? null

        stream.next()
        let count = 1
        while (stream.peek() === char) {
            stream.next()
            count++
        }

        const nextChar = stream.peek() ?? null

        const leftFlanking =
        !this.isWhitespace(nextChar) &&
        !(this.isPunctuation(nextChar) && !this.isWhitespace(prevChar) && !this.isPunctuation(prevChar))

        const rightFlanking =
        !this.isWhitespace(prevChar) &&
        !(this.isPunctuation(prevChar) && !this.isWhitespace(nextChar) && !this.isPunctuation(nextChar))

        const canOpen =
            char === '_' ? leftFlanking && (!rightFlanking || this.isPunctuation(prevChar)) : leftFlanking

        const canClose =
            char === '_' ? rightFlanking && (!leftFlanking || this.isPunctuation(nextChar)) : rightFlanking

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
            canOpen,
            canClose,
            active: true,
        } as Delimiter)

        return true
    }

    private isWhitespace(char: string | null) {
        return char === null || /\s/.test(char)
    }

    private isPunctuation(char: string | null) {
        return char !== null && /[!-/:-@[-`{-~]/.test(char)
    }
}

export default DelimiterResolver
