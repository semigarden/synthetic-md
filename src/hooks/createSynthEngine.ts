import { uuid } from "../utils";

interface BlockType<T extends string = string> {
    id: string
    type: T
    text: string
    start: number
    end: number
}

type Block =
    | Document
    | Paragraph
    | Heading
    | BlockQuote
    | Code
    | List
    | ListItem
    | ThematicBreak
    | Table
    | TableRow
    | TableCell
    | HTML
    | Footnote
    | TaskListItem

interface Document extends BlockType<'document'> {
    children: Block[]
}

interface Paragraph extends BlockType<'paragraph'> {
}

interface Heading extends BlockType<'heading'> {    start: number
    level: number
}

interface BlockQuote extends BlockType<'blockQuote'> {
}

interface Code extends BlockType<'code'> {
    language: string
    code: string
}

interface List extends BlockType<'list'> {
    ordered: boolean
}

interface ListItem extends BlockType<'listItem'> {
}

interface ThematicBreak extends BlockType<'thematicBreak'> {
}

interface Table extends BlockType<'table'> {
}

interface TableRow extends BlockType<'tableRow'> {
}

interface TableCell extends BlockType<'tableCell'> {
}

interface HTML extends BlockType<'html'> {
}

interface Footnote extends BlockType<'footnote'> {
}

interface TaskListItem extends BlockType<'taskListItem'> {
}


// export type BlockType =
//   | "paragraph"
//   | "heading"
//   | "block-quote"
//   | "list-item"
//   | "empty";

export type InlineType =
  | "text"
  | "strong"
  | "em"
  | "code";

export interface InlineContext {
  id: string;
  type: InlineType;
  blockId: string;
  synthetic: string;
  pure: string;
  start: number;
  end: number;
}

export function createSynthEngine() {
    let sourceText = "";
    let blocks: Block[] = [];
    let inlines = new Map<string, InlineContext[]>();

    function sync(nextText: string) {
        if (sourceText.length > 0 && nextText === sourceText) return;
    
        const prevBlocks = blocks;
        const lines = nextText.split("\n");
        let offset = 0;
        const nextBlocks: Block[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const start = offset;
            const end = i === lines.length - 1 ? nextText.length : offset + line.length + 1;
            const type = detectType(line);

            const prevBlock = prevBlocks.find(b => b.start === start && b.type === type);
            const blockId = prevBlock?.id ?? uuid();

            switch (type) {
                case "paragraph":
                    nextBlocks.push({
                        id: blockId,
                        type: "paragraph",
                        text: line,
                        start,
                        end,
                    });
                    break;
                case "heading":
                    nextBlocks.push({
                        id: blockId,
                        type: "heading",
                        level: 0,
                        text: line,
                        start,
                        end,
                    });
                    break;
                case "blockQuote":
                    nextBlocks.push({
                        id: blockId,
                        type: "blockQuote",
                        text: line,
                        start,
                        end,
                    });
                    break;
                case "listItem":
                    nextBlocks.push({
                        id: blockId,
                        type: "listItem",
                        text: line,
                        start,
                        end,
                    });
                    break;
                default:
                    nextBlocks.push({
                        id: blockId,
                        type: "paragraph",
                        text: line,
                        start,
                        end,
                    });
                    break;
            }

            offset = end;
        }

        if (sourceText.length === 0 && (nextBlocks.length === 0 || nextBlocks[nextBlocks.length - 1].text !== "")) {
            const emptyBlock: Paragraph = {
                id: uuid(),
                type: "paragraph",
                text: "",
                start: nextText.length,
                end: nextText.length,
            };
            nextBlocks.push(emptyBlock);
            
        }

        const newBlockIds = new Set(nextBlocks.map(b => b.id));
        for (const oldId of inlines.keys()) {
            if (!newBlockIds.has(oldId)) {
                inlines.delete(oldId);
            }
        }

        blocks = nextBlocks;
        sourceText = nextText;

        const lastBlock = blocks[blocks.length - 1];
        if (!inlines.has(lastBlock.id)) {
            parseInlines(lastBlock);
        }
    }

    function detectType(line: string): Block["type"] {
        if (line.trim() === "") return "paragraph";
        if (line.startsWith("# ")) return "heading";
        if (line.startsWith("> ")) return "blockQuote";
        if (/^\s*[-*+]\s/.test(line)) return "listItem";
        return "paragraph";
    }

    function parseInlines(block: Block): InlineContext[] {
        const next: InlineContext[] = [];
        let i = 0;
        const text = block.text;

        if (text === "") {
            const emptyInline: InlineContext = {
                id: uuid(),
                type: "text",
                blockId: block.id,
                synthetic: "",
                pure: "",
                start: 0,
                end: 0,
            };
            next.push(emptyInline);
            inlines.set(block.id, next);
            return next;
        }

        let loopIndex = 0;
        while (i < text.length) {
            if (++loopIndex > 1000) {
                console.error("Potential infinite loop detected", JSON.stringify(text, null, 2))
                break;
            }

            let matched = false;

            // `code`
            if (text[i] === "`") {
                const end = text.indexOf("`", i + 1);
                if (end !== -1) {
                    next.push({
                        id: uuid(),
                        type: "code",
                        blockId: block.id,
                        synthetic: text.slice(i, end + 1),
                        pure: text.slice(i + 1, end),
                        start: i,
                        end: end + 1,
                    });
                    i = end + 1;
                    matched = true;
                }
            }
        
            // strong **
            if (!matched && text.slice(i, i + 2) === "**") {
                const end = text.indexOf("**", i + 2);
                if (end !== -1) {
                    next.push({
                        id: uuid(),
                        type: "strong",
                        blockId: block.id,
                        synthetic: text.slice(i, end + 2),
                        pure: text.slice(i + 2, end),
                        start: i,
                        end: end + 2,
                    });
                    i = end + 2;
                } else {
                    next.push({
                        id: uuid(),
                        type: "text",
                        blockId: block.id,
                        synthetic: "**",
                        pure: "**",
                        start: i,
                        end: i + 2,
                    });
                    i += 2;
                }
                matched = true;
            }
        
            // em *
            if (!matched && text[i] === "*" && (i + 1 >= text.length || text[i + 1] !== "*")) {
                const end = text.indexOf("*", i + 1);
                if (end !== -1) {
                    const inner = text.slice(i + 1, end);
                    if (!inner.includes("*")) {
                        next.push({
                            id: uuid(),
                            type: "em",
                            blockId: block.id,
                            synthetic: text.slice(i, end + 1),
                            pure: inner,
                            start: i,
                            end: end + 1,
                        });
                        i = end + 1;
                    } else {
                        next.push({
                            id: uuid(),
                            type: "text",
                            blockId: block.id,
                            synthetic: "*",
                            pure: "*",
                            start: i,
                            end: i + 1,
                        });
                        i += 1;
                    }
                } else {
                    next.push({
                        id: uuid(),
                        type: "text",
                        blockId: block.id,
                        synthetic: "*",
                        pure: "*",
                        start: i,
                        end: i + 1,
                    });
                    i += 1;
                }
                matched = true;
            }
            
            // plain text
            if (!matched) {
                let nextDelim = text.length;
                for (const d of ["**", "*", "`"]) {
                    const p = text.indexOf(d, i);
                    if (p !== -1 && p < nextDelim) nextDelim = p;
                }
                const content = text.slice(i, nextDelim);
                next.push({
                    id: uuid(),
                    type: "text",
                    blockId: block.id,
                    synthetic: content,
                    pure: content,
                    start: i,
                    end: nextDelim,
                });
                i = nextDelim;
            }
        }

        inlines.set(block.id, next);
        return next;
    }


    function getBlocks() {
        return blocks;
    }
    
    function getInlines(block: Block) {
        let current = inlines.get(block.id);
        if (!current || current.length === 0) {
            current = parseInlines(block);
        }
        return current;
    }
    
    function applyInlineEdit(inline: InlineContext, nextPureText: string): string {
        const block = blocks.find(b => b.id === inline.blockId)!;
        const blockInlines = inlines.get(block.id)!;

        let newSynthetic: string;
        switch (inline.type) {
            case "strong":
                newSynthetic = `**${nextPureText}**`;
                break;
            case "em":
                newSynthetic = `*${nextPureText}*`;
                break;
            case "code":
                newSynthetic = `\`${nextPureText}\``;
                break;
            case "text":
            default:
                newSynthetic = nextPureText;
                break;
        }

        const oldLength = inline.end - inline.start;
        const newLength = newSynthetic.length;
        const delta = newLength - oldLength;

        const globalStart = block.start + inline.start;
        const globalEnd = block.start + inline.end;

        const newSourceText =
        sourceText.slice(0, globalStart) +
        newSynthetic +
        sourceText.slice(globalEnd);

        inline.pure = nextPureText;
        inline.synthetic = newSynthetic;
        inline.end += delta;

        const inlineIndex = blockInlines.findIndex(i => i.id === inline.id);
        for (let i = inlineIndex + 1; i < blockInlines.length; i++) {
            blockInlines[i].start += delta;
            blockInlines[i].end += delta;
        }

        sourceText = newSourceText;

        return newSourceText;
    }

    return {
        get blocks() {
            return blocks;
        },
        get sourceText() {
            return sourceText;
        },
        sync,
        getBlocks,
        getInlines,
        applyInlineEdit,
    };
}

export type SynthEngine = ReturnType<typeof createSynthEngine>;
