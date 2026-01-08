import InlineStream from './inlineStream'

export interface LinkDestination {
    url: string
    title?: string
}

export function parseLinkDestination(
    stream: InlineStream
): LinkDestination | null {
    const start = stream.checkpoint()
    if (!stream.consume('(')) return null

    // skip whitespace
    while (!stream.end() && /\s/.test(stream.peek()!)) {
        stream.next()
    }

    if (stream.end()) {
        stream.restore(start)
        return null
    }

    let url = ''

    // bracketed link destination
    if (stream.peek() === '<') {
        stream.next()
        const urlStart = stream.position()

        while (!stream.end() && stream.peek() !== '>') {
            if (stream.peek() === '\\') stream.next()
            stream.next()
        }

        if (!stream.consume('>')) {
            stream.restore(start)
            return null
        }

        url = stream.slice(urlStart, stream.position() - 1)
    }
    // unbracketed link destination
    else {
        const urlStart = stream.position()
        let parenDepth = 0

        while (!stream.end()) {
            const ch = stream.peek()!

            if (ch === '\\') {
                stream.next()
                stream.next()
                continue
            }

            if (/\s/.test(ch) && parenDepth === 0) break

            if (ch === '(') parenDepth++
            if (ch === ')') {
                if (parenDepth === 0) break
                parenDepth--
            }

            stream.next()
        }

        url = stream.slice(urlStart, stream.position())
    }

    // skip whitespace
    while (!stream.end() && /\s/.test(stream.peek()!)) {
        stream.next()
    }

    // optional title
    let title: string | undefined

    if (
        stream.peek() === '"' ||
        stream.peek() === '\'' ||
        stream.peek() === '('
    ) {
        const open = stream.next()!
        const close = open === '(' ? ')' : open
        const titleStart = stream.position()

        while (!stream.end() && stream.peek() !== close) {
            if (stream.peek() === '\\') stream.next()
            stream.next()
        }

        if (!stream.consume(close)) {
            stream.restore(start)
            return null
        }

        title = stream.slice(titleStart, stream.position() - 1)

        while (!stream.end() && /\s/.test(stream.peek()!)) {
            stream.next()
        }
    }

    if (!stream.consume(')')) {
        stream.restore(start)
        return null
    }

    return { url, title }
}
