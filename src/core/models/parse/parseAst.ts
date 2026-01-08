import ParseBlock from './parseBlock'
import ParseInline from './parseInline'
import LinkReferenceState from './linkReferenceState'
import { Block } from '../../types'

class ParseAst {
    public linkReferences = new LinkReferenceState()

    public block = new ParseBlock()
    public inline: ParseInline

    constructor() {
        this.inline = new ParseInline(this.linkReferences)
    }

    public parse(text: string): Block[] {
        this.linkReferences.reset()
        this.parseLinkReferenceDefinitions(text)

        const blocks: Block[] = []
        let offset = 0

        for (const line of text.split('\n')) {
            const produced = this.block.line(line, offset)
            if (produced) blocks.push(...produced)
            offset += line.length + 1
        }

        for (const block of blocks) {
            this.inline.applyRecursive(block)
        }

        return blocks
    }

    public reparseTextFragment(text: string, offset: number): Block[] {
        this.block.reset()
    
        const blocks: Block[] = []

        for (const line of text.split('\n')) {
            const produced = this.block.line(line, offset)
            if (produced) blocks.push(...produced)
            offset += line.length + 1
        }

        for (const block of blocks) {
            this.inline.applyRecursive(block)
        }

        console.log('blocks', JSON.stringify(blocks, null, 2))
    
        return blocks
    }

    private parseLinkReferenceDefinitions(text: string) {
        const refRegex = /^\[([^\]]+)\]:\s*<?([^\s>]+)>?(?:\s+["'(]([^"')]+)["')])?$/gm

        let match: RegExpExecArray | null

        while ((match = refRegex.exec(text)) !== null) {
            const label = match[1].toLowerCase().trim()
            const url = match[2]
            const title = match[3]

            this.linkReferences.set(label, {
                url,
                title,
            })
        }
    }
}

export default ParseAst
