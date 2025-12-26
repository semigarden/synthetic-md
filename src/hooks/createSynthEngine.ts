import { uuid } from "../utils";

export type BlockType =
  | "paragraph"
  | "heading"
  | "block-quote"
  | "list-item"
  | "empty";

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

export interface BlockContext {
  id: string;
  type: BlockType;
  text: string;
  start: number;
  end: number;
}

export function createSynthEngine() {
    let sourceText = "";
    let blocks: BlockContext[] = [];
    let inlines = new Map<string, InlineContext[]>();

    function sync(nextText: string) {
        if (nextText === sourceText) return;
    
        const prevBlocks = blocks;
        const lines = nextText.split("\n");
        let offset = 0;
        const nextBlocks: BlockContext[] = [];

        for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const start = offset;
        const end = i === lines.length - 1 ? nextText.length : offset + line.length + 1;
        const type = detectType(line);

        // Try to reuse block ID if possible
        const prevBlock = prevBlocks.find(b => b.start === start && b.type === type);
        const blockId = prevBlock?.id ?? uuid();

        nextBlocks.push({
            id: blockId,
            type,
            text: line,
            start,
            end,
        });

        offset = end;
        }

        // Clear inlines for removed blocks
        const newBlockIds = new Set(nextBlocks.map(b => b.id));
        for (const oldId of inlines.keys()) {
        if (!newBlockIds.has(oldId)) {
            inlines.delete(oldId);
        }
        }

        blocks = nextBlocks;
        sourceText = nextText;
    }

    function detectType(line: string): BlockType {
        if (line.trim() === "") return "empty";
        if (line.startsWith("# ")) return "heading";
        if (line.startsWith("> ")) return "block-quote";
        if (/^\s*[-*+]\s/.test(line)) return "list-item";
        return "paragraph";
    }

    function parseBlocks(text: string): BlockContext[] {
        const prev = blocks;
        const lines = text.split("\n");
    
        let offset = 0;
        const next: BlockContext[] = [];
    
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const start = offset;
          const end =
            i === lines.length - 1 ? text.length : offset + line.length + 1;
    
          const type = detectType(line);
          const prevBlock = prev.find(b => b.start === start && b.type === type);
    
          next.push({
            id: prevBlock?.id ?? uuid(),
            type,
            text: line,
            start,
            end,
          });
    
          offset = end;
        }
    
        blocks = next;
        sourceText = text;
        console.log('blocks,', JSON.stringify(next, null, 2))
        return next;
    }

    function parseInlines(block: BlockContext): InlineContext[] {
        const existing = inlines.get(block.id) ?? [];
        const next: InlineContext[] = [];
        let i = 0;
        const text = block.text;

        while (i < text.length) {
        let matched = false;

        // Code: `code`
        if (text[i] === "`") {
            const end = text.indexOf("`", i + 1);
            if (end !== -1) {
            const pure = text.slice(i + 1, end);
            const synthetic = text.slice(i, end + 1);
            next.push({
                id: uuid(), // New inline → new ID
                type: "code",
                blockId: block.id,
                synthetic,
                pure,
                start: i,
                end: end + 1,
            });
            i = end + 1;
            matched = true;
            }
        }

        // Strong: **strong**
        if (!matched && text.slice(i, i + 2) === "**") {
            const end = text.indexOf("**", i + 2);
            if (end !== -1) {
            const pure = text.slice(i + 2, end);
            const synthetic = text.slice(i, end + 2);
            next.push({
                id: uuid(),
                type: "strong",
                blockId: block.id,
                synthetic,
                pure,
                start: i,
                end: end + 2,
            });
            i = end + 2;
            matched = true;
            }
        }

        // Em: *em*
        if (!matched && text[i] === "*" && (i + 1 >= text.length || text[i + 1] !== "*")) {
            const end = text.indexOf("*", i + 1);
            if (end !== -1) {
            const inner = text.slice(i + 1, end);
            if (!inner.includes("*")) {
                const pure = inner;
                const synthetic = text.slice(i, end + 1);
                next.push({
                id: uuid(),
                type: "em",
                blockId: block.id,
                synthetic,
                pure,
                start: i,
                end: end + 1,
                });
                i = end + 1;
                matched = true;
            }
            }
        }

        if (!matched) {
            // Text run until next delimiter
            let nextDelim = text.length;
            for (const delim of ["**", "*", "`"]) {
            const pos = text.indexOf(delim, i);
            if (pos !== -1 && pos < nextDelim) nextDelim = pos;
            }
            const pure = text.slice(i, nextDelim);
            next.push({
            id: uuid(),
            type: "text",
            blockId: block.id,
            synthetic: pure,
            pure,
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
    
    function getInlines(block: BlockContext) {
        let current = inlines.get(block.id);
        if (!current || current.length === 0) {
        current = parseInlines(block);
        }
        return current;
    }
    
    function applyInlineEdit(inline: InlineContext, nextPureText: string): string {
        const block = blocks.find(b => b.id === inline.blockId)!;
        const blockInlines = inlines.get(block.id)!;

        // Reconstruct synthetic version with correct delimiters
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

        // Update source text immutably
        const globalStart = block.start + inline.start;
        const globalEnd = block.start + inline.end;

        const newSourceText =
        sourceText.slice(0, globalStart) +
        newSynthetic +
        sourceText.slice(globalEnd);

        // Update internal model surgically
        inline.pure = nextPureText;
        inline.synthetic = newSynthetic;
        inline.end += delta;

        // Shift all subsequent inlines in the same block
        const inlineIndex = blockInlines.findIndex(i => i.id === inline.id);
        for (let i = inlineIndex + 1; i < blockInlines.length; i++) {
        blockInlines[i].start += delta;
        blockInlines[i].end += delta;
        }

        // Update sourceText reference
        sourceText = newSourceText;

        // Note: We do NOT re-parse anything else.
        // Block structure remains valid because we're only editing within a line.

        return newSourceText;
    }

    return {
        get blocks() {
            return blocks;
        },
        sync,
        getBlocks,
        getInlines,
        applyInlineEdit,
    };
}

export type SynthEngine = ReturnType<typeof createSynthEngine>;
