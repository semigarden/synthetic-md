import ParseBlock from './parseBlock'
import ParseInline from './parseInline'
import LinkReferenceState from './linkReferenceState'
import { OpenBlock, Block, List, ListItem } from '../../types'
import { uuid } from '../../utils/utils'

class ParseAst {
    public linkReferences = new LinkReferenceState()
    public openBlocks: OpenBlock[] = []
    public blocks: Block[] = []

    public block = new ParseBlock()
    public inline: ParseInline

    constructor() {
        this.inline = new ParseInline(this.linkReferences)
    }

    public parse(text: string): Block[] {
        this.reset()
        this.parseLinkReferenceDefinitions(text)

        const lines = text.split('\n')
        let offset = 0
    
        for (const line of lines) {
            this.parseLine(line, offset)
            offset += line.length + 1
        }
    
        this.closeAll(offset)

        for (const block of this.blocks) {
            this.inline.applyRecursive(block)
        }

        return this.blocks
    }

    private parseLine(line: string, offset: number) {
        if (line.trim() === '') {
            this.handleBlankLine()
            return
        }

        let state = this.continueContainers(line)
    
        if (this.tryOpenBlockQuote(state.line, offset)) return
        if (this.tryOpenList(state.line, offset)) return
        if (this.tryOpenLeafBlock(state.line, offset)) return

        this.addParagraph(state.line, offset)
    }

    private continueContainers(line: string): { line: string } {
        let rest = line
    
        for (let i = 0; i < this.openBlocks.length; i++) {
            const open = this.openBlocks[i]
    
            if (open.type === 'blockQuote') {
                const m = /^(\s{0,3})>(?:\s?(.*))?$/.exec(rest)
                if (m) {
                    rest = m[2] ?? ''
                    continue
                }
            
                this.openBlocks.splice(i)
                break
            }

            if (open.type === 'listItem') {
                if (rest.startsWith(' '.repeat(open.indent))) {
                    rest = rest.slice(open.indent)
                    continue
                }
    
                this.openBlocks.splice(i)
                break
            }

            if (open.type === 'list') {
                const canContinue =
                    /^(\s{0,3})([-*+])\s+/.test(rest)
    
                if (!canContinue) {
                    this.openBlocks.splice(i)
                    break
                }
    
                continue
            }
        }
    
        return { line: rest }
    }

    private tryOpenLeafBlock(line: string, offset: number): boolean {
        const detected = this.block.detectType(line)
    
        const parent = this.openBlocks.at(-1)?.block
        const attach = (block: Block) => {
            if (parent && 'blocks' in parent) parent.blocks.push(block)
            else this.blocks.push(block)
        }
    
        switch (detected.type) {
            case 'heading': {
                const block: Block = {
                    id: uuid(),
                    type: 'heading',
                    level: detected.level!,
                    text: line,
                    position: { start: offset, end: offset + line.length },
                    inlines: [],
                }
                attach(block)
                return true
            }
    
            case 'thematicBreak': {
                const block: Block = {
                    id: uuid(),
                    type: 'thematicBreak',
                    text: line,
                    position: { start: offset, end: offset + line.length },
                    inlines: [],
                }
                attach(block)
                return true
            }
    
            case 'codeBlock': {
                const produced = this.block.line(line, offset)
                if (produced) {
                    for (const b of produced) attach(b)
                }
                return true
            }
    
            case 'table': {
                const produced = this.block.line(line, offset)
                if (produced) {
                    for (const b of produced) attach(b)
                }
                return true
            }
    
            case 'htmlBlock': {
                const block: Block = {
                    id: uuid(),
                    type: 'htmlBlock',
                    text: line,
                    position: { start: offset, end: offset + line.length },
                    inlines: [],
                }
                attach(block)
                return true
            }
        }
    
        return false
    }

    private tryOpenBlockQuote(line: string, offset: number): boolean {
        const match = /^(\s{0,3})>(?:\s?(.*))?$/.exec(line)
        if (!match) return false
    
        const indent = match[1].length
        const content = match[2] ?? ''
    
        const last = this.openBlocks.at(-1)
    
        if (last?.type === 'blockQuote') {
            this.parseLine(content, offset + indent + 1)
            return true
        }
    
        const blockQuote: Block = {
            id: uuid(),
            type: 'blockQuote',
            text: '',
            position: { start: offset, end: offset },
            blocks: [],
            inlines: [],
        }
    
        const parent = this.openBlocks.at(-1)?.block
        if (parent && 'blocks' in parent) {
            parent.blocks.push(blockQuote)
        } else {
            this.blocks.push(blockQuote)
        }
    
        this.openBlocks.push({
            block: blockQuote,
            type: 'blockQuote',
            indent,
        })
    
        this.parseLine(content, offset + indent + 1)
        return true
    }

    private tryOpenList(line: string, offset: number): boolean {
        const m = /^(\s{0,3})([-*+])\s+(.*)$/.exec(line)
        if (!m) return false
    
        const indent = m[1].length
        const marker = m[2]
        const content = m[3]
    
        let list = this.openBlocks.findLast(b => b.type === 'list')?.block
    
        if (!list) {
            list = {
                id: uuid(),
                type: 'list',
                text: '',
                ordered: false,
                blocks: [],
                position: { start: offset, end: offset },
                inlines: [],
                tight: true,
            } as List
            this.blocks.push(list)
            this.openBlocks.push({ block: list, type: 'list', indent })
        }

        const item = {
            id: uuid(),
            type: 'listItem',
            text: '',
            blocks: [],
            position: { start: offset, end: offset },
            inlines: [],
        } as ListItem
    
        (list as List).blocks.push(item)
        this.openBlocks.push({
            block: item,
            type: 'listItem',
            indent: indent + marker.length + 1,
        })
    
        this.addParagraph(content, offset + indent + marker.length + 1)
        return true
    }

    private addParagraph(text: string, offset: number) {
        let parent = this.openBlocks.at(-1)?.block
    
        if (parent?.type === 'list') {
            parent = undefined
        }
    
        const p: Block = {
            id: uuid(),
            type: 'paragraph',
            text,
            position: { start: offset, end: offset + text.length },
            inlines: [],
        }
    
        if (parent && 'blocks' in parent) parent.blocks.push(p)
        else this.blocks.push(p)
    
        this.openBlocks.push({ block: p, type: 'paragraph', indent: 0 })
    }    

    private handleBlankLine() {
        while (this.openBlocks.at(-1)?.type === 'paragraph') {
            this.openBlocks.pop()
        }
    
        const list = this.openBlocks.findLast(b => b.type === 'list')
        if (list) (list.block as List).tight = false
    }

    private closeAll(offset: number) {
        this.openBlocks = []
    }


    public reparseTextFragment(text: string, offset: number): Block[] {
        this.block.reset()
    
        const blocks: Block[] = []

        for (const line of text.split('\n')) {
            const produced = this.block.line(line, offset)
            if (produced) blocks.push(...produced)
            offset += line.length + 1
        }

        const flushed = this.block.flush(offset)
        if (flushed) blocks.push(...flushed)

        for (const block of blocks) {
            this.inline.applyRecursive(block)
        }

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

    private reset() {
        this.openBlocks = []
        this.blocks = []
    }
}

export default ParseAst
