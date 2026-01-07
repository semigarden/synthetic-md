import ParseBlock from "./parseBlock"
import ParseInline from "./parseInline"
import { Block } from "../../types"

class ParseAst {
    public block = new ParseBlock()
    public inline = new ParseInline()

    public parse(text: string): Block[] {
        this.inline.parseLinkReferenceDefinitions(text)

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

    public reparseTextFragment(
        text: string,
        offset: number,
    ): Block[] {
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
    
        return blocks
    }
}

export default ParseAst
