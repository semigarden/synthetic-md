import type LinkReferenceState from './linkReferenceState'

function parseLinkReferenceDefinitions(text: string, linkReferences: LinkReferenceState) {
    const refRegex =
        /^\[([^\]]+)\]:\s*<?([^\s>]+)>?(?:\s+["'(]([^"')]+)["')])?$/gm

    let match: RegExpExecArray | null
    while ((match = refRegex.exec(text)) !== null) {
        const label = match[1].toLowerCase().trim()
        const url = match[2]
        const title = match[3]
        linkReferences.set(label, { url, title })
    }
}

export { parseLinkReferenceDefinitions }
