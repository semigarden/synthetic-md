import { uuid } from "../utils";
import { decodeHTMLEntity } from "../utils/htmlEntities";

interface BlockType<T extends string = string> {
    id: string
    type: T
    text: string
    start: number
    end: number
}

export type Block =
    | Document
    | Paragraph
    | Heading
    | BlockQuote
    | CodeBlock
    | List
    | ListItem
    | ThematicBreak
    | Table
    | TableRow
    | TableCell
    | HTMLBlock
    | Footnote
    | TaskListItem
    | BlankLine

interface Document extends BlockType<'document'> {
    children: Block[]
}

interface Paragraph extends BlockType<'paragraph'> {
}

interface BlankLine extends BlockType<'blankLine'> {
}

interface Heading extends BlockType<'heading'> {
    start: number
    level: number
}

interface BlockQuote extends BlockType<'blockQuote'> {
    children: Block[]
}

interface CodeBlock extends BlockType<'codeBlock'> {
    language?: string
    isFenced: boolean
    fence?: string
}

interface List extends BlockType<'list'> {
    ordered: boolean
    listStart?: number
    tight: boolean
    children: ListItem[]
}

interface ListItem extends BlockType<'listItem'> {
    checked?: boolean
}

interface ThematicBreak extends BlockType<'thematicBreak'> {
}

interface Table extends BlockType<'table'> {
    children: TableRow[]
}

interface TableRow extends BlockType<'tableRow'> {
    children: TableCell[]
}

interface TableCell extends BlockType<'tableCell'> {
}

interface HTMLBlock extends BlockType<'htmlBlock'> {
}

interface Footnote extends BlockType<'footnote'> {
    label: string
}

interface TaskListItem extends BlockType<'taskListItem'> {
    checked: boolean
}


interface InlineType<T extends string = string> {
    id: string
    blockId: string
    type: T
    synthetic: string
    pure: string
    start: number
    end: number
}

export type Inline =
    | Text
    | Emphasis
    | Strong
    | CodeSpan
    | Link
    | Autolink
    | Image
    | Strikethrough
    | FootnoteRef
    | Emoji
    | SoftBreak
    | HardBreak
    | RawHTML
    | Entity

interface Text extends InlineType<'text'> {
}

interface Emphasis extends InlineType<'emphasis'> {
    children: Inline[]
}

interface Strong extends InlineType<'strong'> {
    children: Inline[]
}

interface CodeSpan extends InlineType<'codeSpan'> {
}

interface Link extends InlineType<'link'> {
    url: string
    title?: string
    children: Inline[]
}

interface Autolink extends InlineType<'autolink'> {
    url: string
}

interface Image extends InlineType<'image'> {
    url: string
    alt: string
    title?: string
}

interface Strikethrough extends InlineType<'strikethrough'> {
    children: Inline[]
}

interface FootnoteRef extends InlineType<'footnoteRef'> {
    label: string
}

interface Emoji extends InlineType<'emoji'> {
    name: string
}

interface SoftBreak extends InlineType<'softBreak'> {
}

interface HardBreak extends InlineType<'hardBreak'> {
}

interface RawHTML extends InlineType<'rawHTML'> {
}

interface Entity extends InlineType<'entity'> {
    decoded: string
}

interface DetectedBlock {
    type: Block["type"];
    level?: number;
    ordered?: boolean;
    listStart?: number;
    language?: string;
    fence?: string;
    checked?: boolean;
    label?: string;
}

interface ParseState {
    inFencedCodeBlock: boolean;
    codeBlockFence: string;
    codeBlockId: string;
}

// Link reference definitions for reference-style links
interface LinkReference {
    url: string;
    title?: string;
}

// Delimiter for emphasis processing
interface Delimiter {
    type: '*' | '_' | '~';
    length: number;
    position: number;
    canOpen: boolean;
    canClose: boolean;
    active: boolean;
}

export function createSynthEngine() {
    let sourceText = "";
    let blocks: Block[] = [];
    let inlines = new Map<string, Inline[]>();
    let linkReferences = new Map<string, LinkReference>();

    function sync(nextText: string) {
        if (sourceText.length > 0 && nextText === sourceText) return;
    
        const prevBlocks = blocks;
        const lines = nextText.split("\n");
        let offset = 0;
        const nextBlocks: Block[] = [];
        
        // Track state across lines
        const state: ParseState = {
            inFencedCodeBlock: false,
            codeBlockFence: "",
            codeBlockId: "",
        };

        // First pass: collect link reference definitions
        linkReferences.clear();
        parseLinkReferenceDefinitions(nextText);

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const start = offset;
            const end = i === lines.length - 1 ? nextText.length : offset + line.length;

            // Handle fenced code block continuation/closing
            if (state.inFencedCodeBlock) {
                const closeMatch = line.match(new RegExp(`^\\s{0,3}${state.codeBlockFence.charAt(0)}{${state.codeBlockFence.length},}\\s*$`));
                if (closeMatch) {
                    // Close the code block
                    const existingBlock = nextBlocks.find(b => b.id === state.codeBlockId) as CodeBlock;
                    if (existingBlock) {
                        existingBlock.text += "\n" + line;
                        existingBlock.end = end;
                    }
                    state.inFencedCodeBlock = false;
                    state.codeBlockFence = "";
                    state.codeBlockId = "";
                } else {
                    // Add line to code block
                    const existingBlock = nextBlocks.find(b => b.id === state.codeBlockId) as CodeBlock;
                    if (existingBlock) {
                        existingBlock.text += "\n" + line;
                        existingBlock.end = end;
                    }
                }
                offset = end + 1;
                continue;
            }

            const detectedBlock = detectType(line);
            const prevBlock = prevBlocks.find(b => b.start === start && b.type === detectedBlock.type);
            const blockId = prevBlock?.id ?? uuid();

            let block: Block;

            switch (detectedBlock.type) {
                case "heading":
                    block = {
                        id: blockId,
                        type: "heading",
                        level: detectedBlock.level!,
                        text: line,
                        start,
                        end,
                    };
                    nextBlocks.push(block);
                    break;

                case "blockQuote": {
                    // Handle nested content in blockquotes
                    const quoteContent = line.replace(/^>\s?/, "");
                    block = {
                        id: blockId,
                        type: "blockQuote",
                        text: quoteContent,
                        start,
                        end,
                        children: [],
                    };
                    nextBlocks.push(block);
                    break;
                }

                case "listItem": {
                    const listItemText = line.replace(/^(\s*([-*+]|(\d+[.)])))\s+/, "");
                    const listItem: ListItem = {
                        id: uuid(),
                        type: "listItem",
                        text: listItemText,
                        start,
                        end,
                    };

                    // Find or create parent list
                    const lastBlock = nextBlocks[nextBlocks.length - 1];
                    if (lastBlock && lastBlock.type === "list" && (lastBlock as List).ordered === detectedBlock.ordered) {
                        (lastBlock as List).children.push(listItem);
                        (lastBlock as List).end = end;
                    } else {
                        const newList: List = {
                            id: blockId,
                            type: "list",
                            text: "",
                            start,
                            end,
                            ordered: detectedBlock.ordered ?? false,
                            listStart: detectedBlock.listStart,
                            tight: true,
                            children: [listItem],
                        };
                        nextBlocks.push(newList);
                    }
                    break;
                }

                case "taskListItem": {
                    const taskMatch = line.match(/^\s*([-*+])\s+\[([ xX])\]\s+(.*)/);
                    block = {
                        id: blockId,
                        type: "taskListItem",
                        text: taskMatch ? taskMatch[3] : line,
                        checked: taskMatch ? taskMatch[2].toLowerCase() === 'x' : false,
                        start,
                        end,
                    };
                    nextBlocks.push(block);
                    break;
                }

                case "thematicBreak":
                    block = {
                        id: blockId,
                        type: "thematicBreak",
                        text: line,
                        start,
                        end,
                    };
                    nextBlocks.push(block);
                    break;

                case "codeBlock": {
                    const fenceMatch = line.match(/^(\s{0,3})(```+|~~~+)(.*)$/);
                    if (fenceMatch) {
                        state.inFencedCodeBlock = true;
                        state.codeBlockFence = fenceMatch[2];
                        state.codeBlockId = blockId;
                        block = {
                            id: blockId,
                            type: "codeBlock",
                            text: line,
                            language: fenceMatch[3].trim() || undefined,
                            isFenced: true,
                            fence: fenceMatch[2],
                            start,
                            end,
                        };
                        nextBlocks.push(block);
                    } else {
                        // Indented code block (4 spaces)
                        block = {
                            id: blockId,
                            type: "codeBlock",
                            text: line.replace(/^ {4}/, ""),
                            isFenced: false,
                            start,
                            end,
                        };
                        nextBlocks.push(block);
                    }
                    break;
                }

                case "table": {
                    const table: Table = {
                        id: blockId,
                        type: "table",
                        text: "",
                        start,
                        end,
                        children: [],
                    };
                    const cells = parseTableRow(line);
                    const row: TableRow = {
                        id: uuid(),
                        type: "tableRow",
                        text: line,
                        start,
                        end,
                        children: cells.map((cellText) => ({
                            id: uuid(),
                            type: "tableCell" as const,
                            text: cellText.trim(),
                            start,
                            end,
                        })),
                    };
                    table.children.push(row);
                    nextBlocks.push(table);
                    break;
                }

                case "footnote": {
                    const footnoteMatch = line.match(/^\[\^([^\]]+)\]:\s*(.*)/);
                    block = {
                        id: blockId,
                        type: "footnote",
                        text: footnoteMatch ? footnoteMatch[2] : line,
                        label: footnoteMatch ? footnoteMatch[1] : "",
                        start,
                        end,
                    };
                    nextBlocks.push(block);
                    break;
                }

                case "htmlBlock":
                    block = {
                        id: blockId,
                        type: "htmlBlock",
                        text: line,
                        start,
                        end,
                    };
                    nextBlocks.push(block);
                    break;

                case "blankLine":
                    block = {
                        id: blockId,
                        type: "blankLine",
                        text: "",
                        start,
                        end,
                    };
                    nextBlocks.push(block);
                    break;

                case "paragraph":
                default: {
                    // Check if we can continue previous paragraph (lazy continuation)
                    const lastBlock = nextBlocks[nextBlocks.length - 1];
                    if (lastBlock && lastBlock.type === "paragraph" && line.trim() !== "") {
                        lastBlock.text += "\n" + line;
                        lastBlock.end = end;
                    } else {
                        block = {
                            id: blockId,
                            type: "paragraph",
                            text: line,
                            start,
                            end,
                        };
                        nextBlocks.push(block);
                    }
                    break;
                }
            }

            offset = end + 1;
        }

        // Ensure there's always at least one block
        if (nextBlocks.length === 0) {
            const emptyBlock: Paragraph = {
                id: uuid(),
                type: "paragraph",
                text: "",
                start: 0,
                end: 0,
            };
            nextBlocks.push(emptyBlock);
        }

        // Clean up orphaned inline caches
        const newBlockIds = new Set<string>();
        const collectIds = (blockList: Block[]) => {
            for (const b of blockList) {
                newBlockIds.add(b.id);
                if ('children' in b && Array.isArray(b.children)) {
                    collectIds(b.children as Block[]);
                }
            }
        };
        collectIds(nextBlocks);
        
        for (const oldId of inlines.keys()) {
            if (!newBlockIds.has(oldId)) {
                inlines.delete(oldId);
            }
        }

        blocks = nextBlocks;
        sourceText = nextText;

        // console.log("blocks", JSON.stringify(blocks, null, 2));

        const lastBlock = blocks[blocks.length - 1];
        if (!inlines.has(lastBlock.id)) {
            parseInlines(lastBlock);
        }
    }

    function parseTableRow(line: string): string[] {
        const cells: string[] = [];
        let current = "";
        let escaped = false;
        let inCode = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (escaped) {
                current += char;
                escaped = false;
                continue;
            }
            
            if (char === "\\") {
                escaped = true;
                current += char;
                continue;
            }
            
            if (char === "`") {
                inCode = !inCode;
                current += char;
                continue;
            }
            
            if (char === "|" && !inCode) {
                cells.push(current);
                current = "";
                continue;
            }
            
            current += char;
        }
        
        if (current || cells.length > 0) {
            cells.push(current);
        }
        
        // Remove empty first/last cells from leading/trailing pipes
        if (cells.length > 0 && cells[0].trim() === "") cells.shift();
        if (cells.length > 0 && cells[cells.length - 1].trim() === "") cells.pop();
        
        return cells;
    }

    function parseLinkReferenceDefinitions(text: string) {
        // Match: [label]: url "optional title"
        const refRegex = /^\[([^\]]+)\]:\s*<?([^\s>]+)>?(?:\s+["'(]([^"')]+)["')])?$/gm;
        let match;
        while ((match = refRegex.exec(text)) !== null) {
            const label = match[1].toLowerCase().trim();
            const url = match[2];
            const title = match[3];
            if (!linkReferences.has(label)) {
                linkReferences.set(label, { url, title });
            }
        }
    }

    function detectType(line: string): DetectedBlock {
        const trimmed = line.trim();

        // Empty line -> blank line
        if (trimmed === "") return { type: "blankLine" };

        // ATX Heading: # H1, ## H2, etc. (up to 6 levels)
        const headingMatch = trimmed.match(/^(#{1,6})(?:\s+(.*))?$/);
        if (headingMatch) {
            return { type: "heading", level: headingMatch[1].length };
        }

        // Blockquote: > quote (can be just > with no content)
        if (/^>/.test(line)) {
            return { type: "blockQuote" };
        }

        // Thematic break: ---, ***, ___ (at least 3, can have spaces between)
        if (/^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
            return { type: "thematicBreak" };
        }

        // Fenced code block: ``` or ~~~ (at least 3)
        if (/^\s{0,3}(```+|~~~+)/.test(line)) {
            return { type: "codeBlock" };
        }

        // Indented code block: 4+ spaces (not in a list context)
        if (/^ {4,}[^ ]/.test(line)) {
            return { type: "codeBlock" };
        }

        // Task list item: - [ ] or - [x] or * [ ] etc.
        const taskListMatch = /^\s{0,3}([-*+])\s+\[([ xX])\]\s+/.exec(line);
        if (taskListMatch) {
            return { 
                type: "taskListItem", 
                ordered: false,
                checked: taskListMatch[2].toLowerCase() === 'x'
            };
        }

        // Unordered list item: -, *, + followed by space
        const unorderedListMatch = /^\s{0,3}([-*+])\s+/.exec(line);
        if (unorderedListMatch) {
            return { type: "listItem", ordered: false };
        }

        // Ordered list item: 1. or 1) etc.
        const orderedListMatch = /^\s{0,3}(\d{1,9})([.)])\s+/.exec(line);
        if (orderedListMatch) {
            return { 
                type: "listItem", 
                ordered: true,
                listStart: parseInt(orderedListMatch[1], 10)
            };
        }

        // Table row: line contains at least one | not at start/end only
        if (/\|/.test(trimmed) && !/^\|[-:\s|]+\|$/.test(trimmed)) {
            // Check it's not just a delimiter row
            if (!/^[-:\s|]+$/.test(trimmed.replace(/^\||\|$/g, ''))) {
                return { type: "table" };
            }
        }

        // Footnote definition: [^label]: text
        if (/^\[\^[^\]]+\]:/.test(trimmed)) {
            return { type: "footnote" };
        }

        // HTML block
        if (/^\s{0,3}<(?:script|pre|style|textarea)[\s>]/i.test(line) ||
            /^\s{0,3}<!--/.test(line) ||
            /^\s{0,3}<\?/.test(line) ||
            /^\s{0,3}<![A-Z]/.test(line) ||
            /^\s{0,3}<!\[CDATA\[/.test(line) ||
            /^\s{0,3}<\/?(?:address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h1|h2|h3|h4|h5|h6|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)(?:\s|\/?>|$)/i.test(line)) {
            return { type: "htmlBlock" };
        }

        // Link reference definition (skip for now, handled separately)
        if (/^\s{0,3}\[([^\]]+)\]:\s*/.test(line)) {
            // Could be a link reference, but for block purposes treat as paragraph
            return { type: "paragraph" };
        }

        // Default fallback -> paragraph
        return { type: "paragraph" };
    }

    function parseInlines(block: Block): Inline[] {
        const next: Inline[] = [];
        const text = block.text;
        const blockId = block.id;

        if (text === "") {
            const emptyInline: Inline = {
                id: uuid(),
                type: "text",
                blockId,
                synthetic: "",
                pure: "",
                start: 0,
                end: 0,
            };
            next.push(emptyInline);
            inlines.set(blockId, next);
            return next;
        }

        // Skip inline parsing for code blocks
        if (block.type === "codeBlock") {
            const codeBlock = block as CodeBlock;
            const codeContent = codeBlock.isFenced 
                ? extractFencedCodeContent(text, codeBlock.fence!)
                : text;
            next.push({
                id: uuid(),
                type: "text",
                blockId,
                synthetic: text,
                pure: codeContent,
                start: 0,
                end: text.length,
            });
            inlines.set(blockId, next);
            return next;
        }

        // For headings, extract content after the # markers
        let parseText = text;
        let textOffset = 0;
        if (block.type === "heading") {
            const match = text.match(/^(#{1,6})\s+/);
            if (match) {
                textOffset = match[0].length;
                parseText = text.slice(textOffset);
            }
        }

        const result = parseInlineContent(parseText, blockId, textOffset);
        next.push(...result);

        inlines.set(blockId, next);
        return next;
    }

    function extractFencedCodeContent(text: string, fence: string): string {
        const lines = text.split("\n");
        if (lines.length <= 1) return "";
        // Remove first line (opening fence) and last line (closing fence if present)
        const contentLines = lines.slice(1);
        const closingPattern = new RegExp(`^\\s{0,3}${fence.charAt(0)}{${fence.length},}\\s*$`);
        if (contentLines.length > 0 && closingPattern.test(contentLines[contentLines.length - 1])) {
            contentLines.pop();
        }
        return contentLines.join("\n");
    }

    function parseInlineContent(text: string, blockId: string, offset: number = 0): Inline[] {
        const result: Inline[] = [];
        const delimiterStack: Delimiter[] = [];
        let pos = 0;
        let textStart = 0;

        const addText = (start: number, end: number) => {
            if (end > start) {
                const content = text.slice(start, end);
                if (content.length > 0) {
                    result.push({
                        id: uuid(),
                        type: "text",
                        blockId,
                        synthetic: content,
                        pure: decodeHTMLEntity(content),
                        start: offset + start,
                        end: offset + end,
                    });
                }
            }
        };

        // Flanking rules for * and _
        const isLeftFlanking = (pos: number, runLength: number): boolean => {
            const afterRun = pos + runLength;
            if (afterRun >= text.length) return false;
            const charAfter = text[afterRun];
            const charBefore = pos > 0 ? text[pos - 1] : ' ';
            
            // Not followed by whitespace
            if (/\s/.test(charAfter)) return false;
            // Not followed by punctuation OR preceded by whitespace/punctuation
            if (/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/.test(charAfter)) {
                return /\s/.test(charBefore) || /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/.test(charBefore);
            }
            return true;
        };

        const isRightFlanking = (pos: number, runLength: number): boolean => {
            if (pos === 0) return false;
            const charBefore = text[pos - 1];
            const charAfter = pos + runLength < text.length ? text[pos + runLength] : ' ';
            
            // Not preceded by whitespace
            if (/\s/.test(charBefore)) return false;
            // Not preceded by punctuation OR followed by whitespace/punctuation
            if (/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/.test(charBefore)) {
                return /\s/.test(charAfter) || /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/.test(charAfter);
            }
            return true;
        };

        while (pos < text.length) {
            // Backslash escapes
            if (text[pos] === "\\" && pos + 1 < text.length) {
                const escaped = text[pos + 1];
                if (/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/.test(escaped)) {
                    addText(textStart, pos);
                    result.push({
                        id: uuid(),
                        type: "text",
                        blockId,
                        synthetic: text.slice(pos, pos + 2),
                        pure: escaped,
                        start: offset + pos,
                        end: offset + pos + 2,
                    });
                    pos += 2;
                    textStart = pos;
                    continue;
                }
                // Hard line break: backslash at end of line
                if (escaped === "\n") {
                    addText(textStart, pos);
                    result.push({
                        id: uuid(),
                        type: "hardBreak",
                        blockId,
                        synthetic: "\\\n",
                        pure: "\n",
                        start: offset + pos,
                        end: offset + pos + 2,
                    });
                    pos += 2;
                    textStart = pos;
                    continue;
                }
            }

            // Entity references
            if (text[pos] === "&") {
                const entityMatch = text.slice(pos).match(/^&(?:#[xX]([0-9a-fA-F]{1,6});|#(\d{1,7});|([a-zA-Z][a-zA-Z0-9]{1,31});)/);
                if (entityMatch) {
                    addText(textStart, pos);
                    const entityRaw = entityMatch[0];
                    const decoded = decodeHTMLEntity(entityRaw);
                    result.push({
                        id: uuid(),
                        type: "entity",
                        blockId,
                        synthetic: entityRaw,
                        pure: decoded,
                        decoded,
                        start: offset + pos,
                        end: offset + pos + entityRaw.length,
                    });
                    pos += entityRaw.length;
                    textStart = pos;
                    continue;
                }
            }

            // Code spans - variable backtick counts
            if (text[pos] === "`") {
                addText(textStart, pos);
                let backtickCount = 1;
                while (pos + backtickCount < text.length && text[pos + backtickCount] === "`") {
                    backtickCount++;
                }

                // Search for matching closing backticks
                let searchPos = pos + backtickCount;
                let found = false;
                while (searchPos < text.length) {
                    if (text[searchPos] === "`") {
                        let closeCount = 1;
                        while (searchPos + closeCount < text.length && text[searchPos + closeCount] === "`") {
                            closeCount++;
                        }
                        if (closeCount === backtickCount) {
                            // Extract code content, normalize line endings, collapse spaces
                            let codeContent = text.slice(pos + backtickCount, searchPos);
                            codeContent = codeContent.replace(/\n/g, " ");
                            // Strip one leading/trailing space if content starts AND ends with space
                            if (codeContent.length > 0 && codeContent[0] === " " && codeContent[codeContent.length - 1] === " " && codeContent.trim().length > 0) {
                                codeContent = codeContent.slice(1, -1);
                            }
                            
                            result.push({
                                id: uuid(),
                                type: "codeSpan",
                                blockId,
                                synthetic: text.slice(pos, searchPos + backtickCount),
                                pure: codeContent,
                                start: offset + pos,
                                end: offset + searchPos + backtickCount,
                            });
                            pos = searchPos + backtickCount;
                            textStart = pos;
                            found = true;
                            break;
                        }
                        searchPos += closeCount;
                    } else {
                        searchPos++;
                    }
                }
                
                if (!found) {
                    // No matching backticks, treat as literal
                    result.push({
                        id: uuid(),
                        type: "text",
                        blockId,
                        synthetic: "`".repeat(backtickCount),
                        pure: "`".repeat(backtickCount),
                        start: offset + pos,
                        end: offset + pos + backtickCount,
                    });
                    pos += backtickCount;
                    textStart = pos;
                }
                continue;
            }

            // Autolinks
            if (text[pos] === "<") {
                const autolinkMatch = text.slice(pos).match(/^<([a-zA-Z][a-zA-Z0-9+.-]{1,31}:[^\s<>]*)>/);
                if (autolinkMatch) {
                    addText(textStart, pos);
                    result.push({
                        id: uuid(),
                        type: "autolink",
                        blockId,
                        synthetic: autolinkMatch[0],
                        pure: autolinkMatch[1],
                        url: autolinkMatch[1],
                        start: offset + pos,
                        end: offset + pos + autolinkMatch[0].length,
                    });
                    pos += autolinkMatch[0].length;
                    textStart = pos;
                    continue;
                }

                // Email autolinks
                const emailMatch = text.slice(pos).match(/^<([a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*)>/);
                if (emailMatch) {
                    addText(textStart, pos);
                    result.push({
                        id: uuid(),
                        type: "autolink",
                        blockId,
                        synthetic: emailMatch[0],
                        pure: emailMatch[1],
                        url: "mailto:" + emailMatch[1],
                        start: offset + pos,
                        end: offset + pos + emailMatch[0].length,
                    });
                    pos += emailMatch[0].length;
                    textStart = pos;
                    continue;
                }

                // Raw HTML
                const htmlMatch = text.slice(pos).match(/^<(\/?[a-zA-Z][a-zA-Z0-9]*\b[^>]*>|!--[\s\S]*?-->|!\[CDATA\[[\s\S]*?\]\]>|\?[^>]*\?>|![A-Z]+[^>]*>)/);
                if (htmlMatch) {
                    addText(textStart, pos);
                    result.push({
                        id: uuid(),
                        type: "rawHTML",
                        blockId,
                        synthetic: htmlMatch[0],
                        pure: htmlMatch[0],
                        start: offset + pos,
                        end: offset + pos + htmlMatch[0].length,
                    });
                    pos += htmlMatch[0].length;
                    textStart = pos;
                    continue;
                }
            }

            // Images ![alt](url "title")
            if (text[pos] === "!" && pos + 1 < text.length && text[pos + 1] === "[") {
                const imageResult = parseImage(text, pos, blockId, offset);
                if (imageResult) {
                    addText(textStart, pos);
                    result.push(imageResult.inline);
                    pos = imageResult.end;
                    textStart = pos;
                    continue;
                }
            }

            // Links [text](url "title") or [text][ref]
            if (text[pos] === "[") {
                const linkResult = parseLink(text, pos, blockId, offset);
                if (linkResult) {
                    addText(textStart, pos);
                    result.push(linkResult.inline);
                    pos = linkResult.end;
                    textStart = pos;
                    continue;
                }
            }

            // Footnote references [^label]
            if (text[pos] === "[" && pos + 1 < text.length && text[pos + 1] === "^") {
                const footnoteMatch = text.slice(pos).match(/^\[\^([^\]]+)\]/);
                if (footnoteMatch) {
                    addText(textStart, pos);
                    result.push({
                        id: uuid(),
                        type: "footnoteRef",
                        blockId,
                        synthetic: footnoteMatch[0],
                        pure: footnoteMatch[1],
                        label: footnoteMatch[1],
                        start: offset + pos,
                        end: offset + pos + footnoteMatch[0].length,
                    });
                    pos += footnoteMatch[0].length;
                    textStart = pos;
                    continue;
                }
            }

            // Strikethrough ~~
            if (text[pos] === "~" && pos + 1 < text.length && text[pos + 1] === "~") {
                let tildeCount = 2;
                while (pos + tildeCount < text.length && text[pos + tildeCount] === "~") {
                    tildeCount++;
                }
                
                if (tildeCount === 2) {
                    const closePos = text.indexOf("~~", pos + 2);
                    if (closePos !== -1) {
                        addText(textStart, pos);
                        const innerText = text.slice(pos + 2, closePos);
                        const innerInlines = parseInlineContent(innerText, blockId, offset + pos + 2);
                        result.push({
                            id: uuid(),
                            type: "strikethrough",
                            blockId,
                            synthetic: text.slice(pos, closePos + 2),
                            pure: innerText,
                            children: innerInlines,
                            start: offset + pos,
                            end: offset + closePos + 2,
                        });
                        pos = closePos + 2;
                        textStart = pos;
                        continue;
                    }
                }
            }

            // Emphasis * and _
            if (text[pos] === "*" || text[pos] === "_") {
                const delimChar = text[pos] as "*" | "_";
                let runLength = 1;
                while (pos + runLength < text.length && text[pos + runLength] === delimChar) {
                    runLength++;
                }

                const leftFlanking = isLeftFlanking(pos, runLength);
                const rightFlanking = isRightFlanking(pos, runLength);

                // For *, can open if left-flanking
                // For _, can open if left-flanking and (not right-flanking OR preceded by punctuation)
                let canOpen = leftFlanking;
                let canClose = rightFlanking;

                if (delimChar === "_") {
                    const charBefore = pos > 0 ? text[pos - 1] : ' ';
                    const charAfter = pos + runLength < text.length ? text[pos + runLength] : ' ';
                    canOpen = leftFlanking && (!rightFlanking || /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/.test(charBefore));
                    canClose = rightFlanking && (!leftFlanking || /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/.test(charAfter));
                }

                if (canOpen || canClose) {
                    addText(textStart, pos);
                    const delimText = delimChar.repeat(runLength);
                    result.push({
                        id: uuid(),
                        type: "text",
                        blockId,
                        synthetic: delimText,
                        pure: delimText,
                        start: offset + pos,
                        end: offset + pos + runLength,
                    });

                    delimiterStack.push({
                        type: delimChar,
                        length: runLength,
                        position: result.length - 1,
                        canOpen,
                        canClose,
                        active: true,
                    });

                    textStart = pos + runLength;
                }

                pos += runLength;
                continue;
            }

            // Hard line break: two+ spaces at end of line followed by newline
            if (text[pos] === " ") {
                let spaceCount = 1;
                while (pos + spaceCount < text.length && text[pos + spaceCount] === " ") {
                    spaceCount++;
                }
                if (spaceCount >= 2 && pos + spaceCount < text.length && text[pos + spaceCount] === "\n") {
                    addText(textStart, pos);
                    result.push({
                        id: uuid(),
                        type: "hardBreak",
                        blockId,
                        synthetic: " ".repeat(spaceCount) + "\n",
                        pure: "\n",
                        start: offset + pos,
                        end: offset + pos + spaceCount + 1,
                    });
                    pos += spaceCount + 1;
                    textStart = pos;
                    continue;
                }
            }

            // Soft line break
            if (text[pos] === "\n") {
                addText(textStart, pos);
                result.push({
                    id: uuid(),
                    type: "softBreak",
                    blockId,
                    synthetic: "\n",
                    pure: " ",
                    start: offset + pos,
                    end: offset + pos + 1,
                });
                pos++;
                textStart = pos;
                continue;
            }

            // Emoji :name:
            if (text[pos] === ":") {
                const emojiMatch = text.slice(pos).match(/^:([a-zA-Z0-9_+-]+):/);
                if (emojiMatch) {
                    addText(textStart, pos);
                    result.push({
                        id: uuid(),
                        type: "emoji",
                        blockId,
                        synthetic: emojiMatch[0],
                        pure: emojiMatch[0],
                        name: emojiMatch[1],
                        start: offset + pos,
                        end: offset + pos + emojiMatch[0].length,
                    });
                    pos += emojiMatch[0].length;
                    textStart = pos;
                    continue;
                }
            }

            pos++;
        }

        addText(textStart, pos);

        // Process emphasis using delimiter stack
        processEmphasis(delimiterStack, result, blockId);

        return result;
    }

    function parseLink(text: string, start: number, blockId: string, offset: number): { inline: Inline; end: number } | null {
        // Find matching ]
        let bracketDepth = 1;
        let pos = start + 1;
        while (pos < text.length && bracketDepth > 0) {
            if (text[pos] === "\\") {
                pos += 2;
                continue;
            }
            if (text[pos] === "[") bracketDepth++;
            if (text[pos] === "]") bracketDepth--;
            pos++;
        }
        
        if (bracketDepth !== 0) return null;
        
        const linkTextEnd = pos - 1;
        const linkText = text.slice(start + 1, linkTextEnd);
        
        // Inline link: [text](url "title")
        if (pos < text.length && text[pos] === "(") {
            const destResult = parseLinkDestinationAndTitle(text, pos);
            if (destResult) {
                const children = parseInlineContent(linkText, blockId, offset + start + 1);
                return {
                    inline: {
                        id: uuid(),
                        type: "link",
                        blockId,
                        synthetic: text.slice(start, destResult.end),
                        pure: linkText,
                        url: destResult.url,
                        title: destResult.title,
                        children,
                        start: offset + start,
                        end: offset + destResult.end,
                    },
                    end: destResult.end,
                };
            }
        }
        
        // Reference link: [text][ref] or [text][] or [text]
        let refLabel = "";
        let refEnd = pos;
        
        if (pos < text.length && text[pos] === "[") {
            const refClosePos = text.indexOf("]", pos + 1);
            if (refClosePos !== -1) {
                refLabel = text.slice(pos + 1, refClosePos).toLowerCase().trim();
                refEnd = refClosePos + 1;
            }
        }
        
        if (refLabel === "") {
            refLabel = linkText.toLowerCase().trim();
        }
        
        const ref = linkReferences.get(refLabel);
        if (ref) {
            const children = parseInlineContent(linkText, blockId, offset + start + 1);
            return {
                inline: {
                    id: uuid(),
                    type: "link",
                    blockId,
                    synthetic: text.slice(start, refEnd),
                    pure: linkText,
                    url: ref.url,
                    title: ref.title,
                    children,
                    start: offset + start,
                    end: offset + refEnd,
                },
                end: refEnd,
            };
        }
        
        return null;
    }

    function parseImage(text: string, start: number, blockId: string, offset: number): { inline: Inline; end: number } | null {
        // start is at "!"
        if (text[start + 1] !== "[") return null;
        
        // Find matching ]
        let bracketDepth = 1;
        let pos = start + 2;
        while (pos < text.length && bracketDepth > 0) {
            if (text[pos] === "\\") {
                pos += 2;
                continue;
            }
            if (text[pos] === "[") bracketDepth++;
            if (text[pos] === "]") bracketDepth--;
            pos++;
        }
        
        if (bracketDepth !== 0) return null;
        
        const altTextEnd = pos - 1;
        const altText = text.slice(start + 2, altTextEnd);
        
        // Inline image: ![alt](url "title")
        if (pos < text.length && text[pos] === "(") {
            const destResult = parseLinkDestinationAndTitle(text, pos);
            if (destResult) {
                return {
                    inline: {
                        id: uuid(),
                        type: "image",
                        blockId,
                        synthetic: text.slice(start, destResult.end),
                        pure: altText,
                        url: destResult.url,
                        alt: altText,
                        title: destResult.title,
                        start: offset + start,
                        end: offset + destResult.end,
                    },
                    end: destResult.end,
                };
            }
        }
        
        // Reference image: ![alt][ref] or ![alt][] or ![alt]
        let refLabel = "";
        let refEnd = pos;
        
        if (pos < text.length && text[pos] === "[") {
            const refClosePos = text.indexOf("]", pos + 1);
            if (refClosePos !== -1) {
                refLabel = text.slice(pos + 1, refClosePos).toLowerCase().trim();
                refEnd = refClosePos + 1;
            }
        }
        
        if (refLabel === "") {
            refLabel = altText.toLowerCase().trim();
        }
        
        const ref = linkReferences.get(refLabel);
        if (ref) {
            return {
                inline: {
                    id: uuid(),
                    type: "image",
                    blockId,
                    synthetic: text.slice(start, refEnd),
                    pure: altText,
                    url: ref.url,
                    alt: altText,
                    title: ref.title,
                    start: offset + start,
                    end: offset + refEnd,
                },
                end: refEnd,
            };
        }
        
        return null;
    }

    function parseLinkDestinationAndTitle(text: string, start: number): { url: string; title?: string; end: number } | null {
        let pos = start;
        if (pos >= text.length || text[pos] !== "(") return null;
        pos++;

        // Skip whitespace
        while (pos < text.length && /[ \t\n]/.test(text[pos])) pos++;
        if (pos >= text.length) return null;

        let url = "";
        
        // Angle-bracketed destination
        if (text[pos] === "<") {
            pos++;
            const urlStart = pos;
            while (pos < text.length && text[pos] !== ">" && text[pos] !== "\n") {
                if (text[pos] === "\\") pos++;
                pos++;
            }
            if (pos >= text.length || text[pos] !== ">") return null;
            url = text.slice(urlStart, pos);
            pos++;
        } else {
            // Unbracketed destination - count parentheses
            const urlStart = pos;
            let parenDepth = 0;
            while (pos < text.length) {
                const ch = text[pos];
                if (ch === "\\") {
                    pos += 2;
                    continue;
                }
                if (/[ \t\n]/.test(ch) && parenDepth === 0) break;
                if (ch === "(") {
                    parenDepth++;
                } else if (ch === ")") {
                    if (parenDepth === 0) break;
                    parenDepth--;
                }
                pos++;
            }
            url = text.slice(urlStart, pos);
        }

        // Skip whitespace
        while (pos < text.length && /[ \t\n]/.test(text[pos])) pos++;

        // Optional title
        let title: string | undefined;
        if (pos < text.length && (text[pos] === '"' || text[pos] === "'" || text[pos] === "(")) {
            const quoteChar = text[pos];
            const closeChar = quoteChar === "(" ? ")" : quoteChar;
            pos++;
            const titleStart = pos;
            while (pos < text.length && text[pos] !== closeChar) {
                if (text[pos] === "\\") pos++;
                pos++;
            }
            if (pos >= text.length) return null;
            title = text.slice(titleStart, pos);
            pos++;
        }

        // Skip whitespace
        while (pos < text.length && /[ \t\n]/.test(text[pos])) pos++;

        // Must end with )
        if (pos >= text.length || text[pos] !== ")") return null;
        pos++;

        return { url, title, end: pos };
    }

    function processEmphasis(stack: Delimiter[], nodes: Inline[], blockId: string) {
        if (stack.length === 0) return;

        const openersBottom: Record<string, Record<number, number>> = {
            "*": { 0: -1, 1: -1, 2: -1 },
            "_": { 0: -1, 1: -1, 2: -1 },
        };

        let current = 0;

        while (current < stack.length) {
            const closer = stack[current];
            if (!closer.canClose || !closer.active) {
                current++;
                continue;
            }

            // Find opener
            let openerIndex = -1;
            const bottomKey = closer.length % 3;
            const bottom = openersBottom[closer.type]?.[bottomKey] ?? -1;

            for (let i = current - 1; i > bottom; i--) {
                const opener = stack[i];
                if (!opener.active || !opener.canOpen) continue;
                if (opener.type !== closer.type) continue;
                
                // "Sum of lengths is not a multiple of 3" rule
                if ((opener.canOpen && opener.canClose) || (closer.canOpen && closer.canClose)) {
                    if ((opener.length + closer.length) % 3 === 0 && opener.length % 3 !== 0 && closer.length % 3 !== 0) {
                        continue;
                    }
                }
                
                openerIndex = i;
                break;
            }

            if (openerIndex === -1) {
                if (!closer.canOpen) {
                    closer.active = false;
                }
                openersBottom[closer.type][bottomKey] = current - 1;
                current++;
                continue;
            }

            const opener = stack[openerIndex];
            const useLength = Math.min(2, Math.min(opener.length, closer.length));
            const isStrong = useLength >= 2;

            // Get nodes between opener and closer
            const openerNodePos = opener.position;
            const closerNodePos = closer.position;
            
            // Extract children between opener and closer
            const children = nodes.slice(openerNodePos + 1, closerNodePos);
            
            // Create emphasis node
            const openerNode = nodes[openerNodePos];
            const closerNode = nodes[closerNodePos];
            
            const emphType = isStrong ? "strong" : "emphasis";
            const delimCount = isStrong ? 2 : 1;
            const delimStr = opener.type.repeat(delimCount);

            // Build the raw text
            let rawText = delimStr;
            for (const child of children) {
                rawText += child.synthetic;
            }
            rawText += delimStr;

            const emphNode: Inline = {
                id: uuid(),
                type: emphType,
                blockId,
                synthetic: rawText,
                pure: children.map(c => c.pure).join(""),
                children: children,
                start: openerNode.start,
                end: closerNode.end,
            };

            // Update opener/closer lengths and text
            opener.length -= useLength;
            closer.length -= useLength;

            if (opener.length === 0) {
                opener.active = false;
            } else {
                const openerTextNode = nodes[openerNodePos];
                if (openerTextNode.type === "text") {
                    openerTextNode.synthetic = opener.type.repeat(opener.length);
                    openerTextNode.pure = opener.type.repeat(opener.length);
                    openerTextNode.end = openerTextNode.start + opener.length;
                }
            }

            if (closer.length === 0) {
                closer.active = false;
            } else {
                const closerTextNode = nodes[closerNodePos];
                if (closerTextNode.type === "text") {
                    closerTextNode.synthetic = closer.type.repeat(closer.length);
                    closerTextNode.pure = closer.type.repeat(closer.length);
                    closerTextNode.start = closerTextNode.end - closer.length;
                }
            }

            // Remove delimiters between opener and closer
            for (let i = openerIndex + 1; i < current; i++) {
                stack[i].active = false;
            }

            // Replace children with emphasis node
            const removeCount = closerNodePos - openerNodePos - 1;
            const insertPos = openerNodePos + 1;
            
            // Remove old children
            nodes.splice(insertPos, removeCount, emphNode);
            
            // Update positions in stack
            const posShift = removeCount - 1;
            for (const d of stack) {
                if (d.position > insertPos) {
                    d.position -= posShift;
                }
            }
            closer.position -= posShift;

            // Remove inactive openers/closers
            if (opener.length === 0) {
                nodes.splice(openerNodePos, 1);
                for (const d of stack) {
                    if (d.position > openerNodePos) {
                        d.position--;
                    }
                }
            }

            // Continue from same position to handle nested emphasis
            current = 0;
        }

        // Clean up remaining delimiter text nodes that weren't matched
        // They stay as text, which is correct
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
    
    function applyInlineEdit(inline: Inline, nextPureText: string): string {
        const block = blocks.find(b => b.id === inline.blockId);
        if (!block) {
            throw new Error(`Block not found for inline edit: ${inline.blockId}`);
        }
        const blockInlines = inlines.get(block.id);
        if (!blockInlines) {
            throw new Error(`Inlines not found for block: ${block.id}`);
        }

        let newSynthetic: string;
        switch (inline.type) {
            case "strong":
                newSynthetic = `**${nextPureText}**`;
                break;
            case "emphasis":
                newSynthetic = `*${nextPureText}*`;
                break;
            case "codeSpan":
                newSynthetic = `\`${nextPureText}\``;
                break;
            case "strikethrough":
                newSynthetic = `~~${nextPureText}~~`;
                break;
            case "link":
                const linkInline = inline as Link;
                newSynthetic = `[${nextPureText}](${linkInline.url}${linkInline.title ? ` "${linkInline.title}"` : ""})`;
                break;
            case "image":
                const imageInline = inline as Image;
                newSynthetic = `![${nextPureText}](${imageInline.url}${imageInline.title ? ` "${imageInline.title}"` : ""})`;
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

    function getLinkReferences() {
        return linkReferences;
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
        getLinkReferences,
    };
}

export type SynthEngine = ReturnType<typeof createSynthEngine>;
