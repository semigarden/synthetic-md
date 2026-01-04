import { uuid, decodeHTMLEntity } from "../utils/utils";
import { ParseState, Delimiter, DetectedBlock, Block, Inline } from './types';
import { CodeBlock, ListItem, List, Paragraph, Table, TableRow, TableCell, Document } from './types';

function levenshteinDistance(a: string, b: string): number {
    const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(0));

    for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= b.length; j++) {
        for (let i = 1; i <= a.length; i++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[j][i] = Math.min(
                matrix[j][i - 1] + 1,
                matrix[j - 1][i] + 1,
                matrix[j - 1][i - 1] + cost
            );
        }
    }
    return matrix[b.length][a.length];
}

function buildAst(text: string, previousAst: Document | null = null): Document {
    const blocks = buildBlocks(text, previousAst);
    const syntheticText = text.replace(/\n/g, '');

    const ast: Document = {
        id: previousAst?.id || uuid(),
        type: "document",
        text,
        position: {
            start: 0,
            end: syntheticText.length,
        },
        blocks,
        inlines: [],
    };

    return ast;
}

export function buildBlocks(text: string, previousAst: Document | null = null): Block[] {
    const lines = text.split("\n");
    let offset = 0;
    const blocks: Block[] = [];
    const state: ParseState = {
        inFencedCodeBlock: false,
        codeBlockFence: "",
        codeBlockId: "",
    };

    const tempUuid = () => uuid();

    parseLinkReferenceDefinitions(text);

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const start = offset;
        const end = offset + line.length;

        if (state.inFencedCodeBlock) {
            const closeMatch = line.match(
                new RegExp(`^\\s{0,3}${state.codeBlockFence.charAt(0)}{${state.codeBlockFence.length},}\\s*$`)
            );
            const currentBlock = blocks.find(b => b.id === state.codeBlockId) as Block;

            if (closeMatch) {
                if (currentBlock) {
                    currentBlock.text += "\n" + line;
                    currentBlock.position.end = end + 1;
                }
                state.inFencedCodeBlock = false;
                state.codeBlockFence = "";
                state.codeBlockId = "";
            } else {
                if (currentBlock) {
                    currentBlock.text += "\n" + line;
                    currentBlock.position.end = end + 1;
                }
            }
            offset = end + 1;
            continue;
        }

        const detectedBlock = detectType(line);
        let block: Block;

        switch (detectedBlock.type) {
            case "heading": {
                block = {
                    id: tempUuid(),
                    type: "heading",
                    level: detectedBlock.level!,
                    text: line,
                    position: { start, end },
                    inlines: [],
                };
                blocks.push(block);
                break;
            }

            case "blockQuote": {
                const quoteContent = line.replace(/^>\s?/, "");
                block = {
                    id: tempUuid(),
                    type: "blockQuote",
                    text: quoteContent,
                    position: { start, end },
                    blocks: [],
                    inlines: [],
                };
                blocks.push(block);
                break;
            }

            case "listItem": {
                const markerMatch = /^(\s*([-*+]|(\d+[.)])))\s+/.exec(line);
                const markerLength = markerMatch ? markerMatch[0].length : 0;
                const listItemText = line.slice(markerLength);

                const paragraph: Block = {
                    id: tempUuid(),
                    type: "paragraph",
                    text: listItemText,
                    position: { start: start + markerLength, end },
                    inlines: [],
                };

                const listItem: Block = {
                    id: tempUuid(),
                    type: "listItem",
                    text: markerMatch ? markerMatch[0] + listItemText : listItemText,
                    position: { start, end },
                    blocks: [paragraph],
                    inlines: [],
                };

                const lastBlock = blocks[blocks.length - 1];
                if (lastBlock && lastBlock.type === "list" && (lastBlock as any).ordered === !!detectedBlock.ordered) {
                    (lastBlock as any).blocks.push(listItem);
                    lastBlock.position.end = end;
                } else {
                    const newList: Block = {
                        id: tempUuid(),
                        type: "list",
                        text: "",
                        position: { start, end },
                        ordered: !!detectedBlock.ordered,
                        listStart: detectedBlock.listStart,
                        tight: true,
                        blocks: [listItem],
                        inlines: [],
                    };
                    blocks.push(newList);
                }
                break;
            }

            case "codeBlock": {
                const fenceMatch = line.match(/^(\s{0,3})(```+|~~~+)(.*)$/);
                if (fenceMatch) {
                    const newTempId = tempUuid();
                    state.inFencedCodeBlock = true;
                    state.codeBlockFence = fenceMatch[2];
                    state.codeBlockId = newTempId;

                    block = {
                        id: newTempId,
                        type: "codeBlock",
                        text: line,
                        language: fenceMatch[3].trim() || undefined,
                        isFenced: true,
                        fence: fenceMatch[2],
                        position: { start, end },
                        inlines: [],
                    };
                    blocks.push(block);
                } else {
                    block = {
                        id: tempUuid(),
                        type: "codeBlock",
                        text: line.replace(/^ {4}/, ""),
                        isFenced: false,
                        position: { start, end },
                        inlines: [],
                    };
                    blocks.push(block);
                }
                break;
            }

            case "paragraph":
            default: {
                block = {
                    id: tempUuid(),
                    type: "paragraph",
                    text: line,
                    position: { start, end },
                    inlines: [],
                }

                const text: Inline = {
                    id: uuid(),
                    type: "text",
                    blockId: block.id,
                    text: { symbolic: "", semantic: "" },
                    position: { start: 0, end: 0 },
                }

                block.inlines.push(text);
                blocks.push(block);

                break;
            }

        }

        offset = end;
    }

    const prevBlocks = previousAst?.blocks || [];
    const usedPrevIds = new Set<string>();

    const prevByType = new Map<string, Block[]>();
    prevBlocks.forEach(b => {
        const list = prevByType.get(b.type) || [];
        list.push(b);
        prevByType.set(b.type, list);
    });

    const simpleSimilarity = (a: string, b: string): number => {
        if (a === b) return 1;
        a = a.trim();
        b = b.trim();
        if (a === "" && b === "") return 1;
        if (a === "" || b === "") return 0;
    
        const longer = a.length > b.length ? a : b;
        const shorter = a.length > b.length ? b : a;
    
        let matches = 0;
        for (let i = 0; i < shorter.length; i++) {
            if (shorter[i] === longer[i]) matches++;
        }
        return matches / longer.length;
    };

    for (let i = 0; i < blocks.length; i++) {
        const newBlock = blocks[i];
        const candidates = prevByType.get(newBlock.type) || [];
    
        let bestMatch: Block | null = null;
        let bestScore = 0;
    
        for (const prev of candidates) {
            if (usedPrevIds.has(prev.id)) continue;
    
            let score = 0;
    
            const posDiff = Math.abs(prev.position.start - newBlock.position.start);
            if (posDiff <= 50) {
                score += 1.0;
            }
    
            const similarity = simpleSimilarity(prev.text, newBlock.text);
            score += similarity;
    
            const lenDiff = Math.abs(prev.text.length - newBlock.text.length);
            if (lenDiff <= 10) {
                score += 0.5;
            }
    
            const minLen = Math.min(prev.text.length, newBlock.text.length);
            if (minLen > 0) {
                const shorter = prev.text.length <= newBlock.text.length ? prev.text : newBlock.text;
                const longer = prev.text.length > newBlock.text.length ? prev.text : newBlock.text;
                if (longer.startsWith(shorter)) {
                    score += 1.0;
                }
                if (longer.endsWith(shorter)) {
                    score += 0.8;
                }
            }
    
            if (score > bestScore) {
                bestScore = score;
                bestMatch = prev;
            }
        }
    
        if (bestMatch && bestScore > 1.5) {
            newBlock.id = bestMatch.id;
            usedPrevIds.add(bestMatch.id);
        }
    }

    const reconcileNested = (blockList: Block[]) => {
        for (const b of blockList) {
            if ('blocks' in b && (b as any).blocks.length > 0) {
                reconcileNested(b.blocks);
            }
        }
    };
    reconcileNested(blocks);

    const prevBlockMap = new Map<string, Block>();
    previousAst?.blocks.forEach(b => {
        if (b.id) prevBlockMap.set(b.id, b);
    });

    for (const block of blocks) {
        const previousVersion = prevBlockMap.get(block.id);
        parseInlinesRecursive(block, previousVersion);
    }

    return blocks;
}

function parseInlinesRecursive(block: Block, previousBlock?: Block) {
    const prevInlines = previousBlock?.inlines || [];

    switch (block.type) {
        case "paragraph":
        case "heading":
        case "codeBlock": {
            const newInlines = parseInlines(block, prevInlines);
            block.inlines = newInlines;
            break;
        }

        default:
            if ('blocks' in block && Array.isArray(block.blocks)) {
                const prevNestedMap = new Map<string, Block>();
                if (previousBlock && 'blocks' in previousBlock && Array.isArray(previousBlock.blocks)) {
                    previousBlock.blocks.forEach((b: Block) => {
                        if (b.id) prevNestedMap.set(b.id, b);
                    });
                }

                for (const childBlock of block.blocks as Block[]) {
                    const prevChild = prevNestedMap.get(childBlock.id);
                    parseInlinesRecursive(childBlock, prevChild);
                }
            }
            break;
    }
}

function parseInlines(block: Block, previousInlines: Inline[] = []): Inline[] {
    const next: Inline[] = [];
    const text = block.text;
    const blockId = block.id;

    if (text === "") {
        const oldEmpty = previousInlines[0];
        next.push({
            id: oldEmpty?.id || uuid(),
            type: "text",
            blockId,
            text: { symbolic: "", semantic: "" },
            position: { start: 0, end: 0 },
        });
        return next;
    }

    if (block.type === "codeBlock") {
        const codeBlock = block as CodeBlock;
        const codeContent = codeBlock.isFenced
            ? extractFencedCodeContent(text, codeBlock.fence!)
            : text;

        const old = previousInlines[0];
        const oldContent = old?.text.semantic || "";

        const shouldReuse = old && (
            codeContent.startsWith(oldContent) ||
            codeContent.endsWith(oldContent) ||
            oldContent.startsWith(codeContent) ||
            oldContent.endsWith(codeContent) ||
            Math.abs(codeContent.length - oldContent.length) < 50
        );

        next.push({
            id: shouldReuse ? old.id : uuid(),
            type: "text",
            blockId,
            text: { symbolic: text, semantic: codeContent },
            position: { start: 0, end: text.length },
        });
        return next;
    }

    let parseText = text;
    let textOffset = 0;
    if (block.type === "heading") {
        const match = text.match(/^(#{1,6})\s+/);
        if (match) {
            textOffset = match[0].length;
            parseText = text.slice(textOffset);
        }
    }

    const newFragments = parseInlineContent(parseText, blockId, textOffset);

    const prevByKey = new Map<string, Inline>();
    const usedIds = new Set<string>();

    for (const prev of previousInlines) {
        const key = `${prev.type}|${prev.text.symbolic}`;
        prevByKey.set(key, prev);
    }

    for (const frag of newFragments) {
        const symbolic = frag.text.symbolic;

        let reusedId: string | null = null;

        if (frag.type === "text") {
            for (const prev of previousInlines) {
                if (usedIds.has(prev.id) || prev.type !== "text") continue;

                const oldText = prev.text.symbolic;

                if (symbolic.startsWith(oldText) && symbolic.length > oldText.length) {
                    reusedId = prev.id;
                    break;
                }

                if (symbolic.endsWith(oldText) && symbolic.length > oldText.length) {
                    reusedId = prev.id;
                    break;
                }

                if (oldText.startsWith(symbolic) && oldText.length > symbolic.length) {
                    reusedId = prev.id;
                    break;
                }

                if (oldText.endsWith(symbolic) && oldText.length > symbolic.length) {
                    reusedId = prev.id;
                    break;
                }

                if (Math.abs(symbolic.length - oldText.length) <= 5) {
                    const distance = levenshteinDistance(symbolic, oldText);
                    if (distance <= 3) {
                        reusedId = prev.id;
                        break;
                    }
                }
            }
        } else {
            const key = `${frag.type}|${symbolic}`;
            const match = prevByKey.get(key);
            if (match && !usedIds.has(match.id)) {
                reusedId = match.id;
            }
        }

        const inlineId = reusedId || uuid();
        if (reusedId) usedIds.add(reusedId);

        next.push({
            ...frag,
            id: inlineId,
            blockId,
        });
    }

    return next;
}


function parseTableRow(line: string): TableCell[] {
    const cellTexts: string[] = [];
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
            cellTexts.push(current);
            current = "";
            continue;
        }
        
        current += char;
    }
    
    if (current || cellTexts.length > 0) {
        cellTexts.push(current);
    }
    
    if (cellTexts.length > 0 && cellTexts[0].trim() === "") cellTexts.shift();
    if (cellTexts.length > 0 && cellTexts[cellTexts.length - 1].trim() === "") cellTexts.pop();

    let cells: TableCell[] = [];
    for (const cellText of cellTexts) {
        const paragraph: Paragraph = {
            id: uuid(),
            type: "paragraph",
            text: cellText,
            position: {
                start: 0,
                end: cellText.length,
            },
            inlines: [],
        };

        cells.push({
            id: uuid(),
            type: "tableCell",
            text: cellText,
            position: {
                start: 0,
                end: cellText.length,
            },
            blocks: [paragraph],
            inlines: [],
        });
    }
    
    return cells;
}

function extractFencedCodeContent(text: string, fence: string): string {
    const lines = text.split("\n");
    if (lines.length <= 1) return "";
    const contentLines = lines.slice(1);
    const closingPattern = new RegExp(`^\\s{0,3}${fence.charAt(0)}{${fence.length},}\\s*$`);
    if (contentLines.length > 0 && closingPattern.test(contentLines[contentLines.length - 1])) {
        contentLines.pop();
    }
    return contentLines.join("\n");
}

export function parseInlineContent(text: string, blockId: string, offset: number = 0): Inline[] {
    const result: Inline[] = [];
    const delimiterStack: Delimiter[] = [];
    let pos = 0;
    let textStart = 0;
    // console.log('parseInlineContent', text, blockId, offset)

    const addText = (start: number, end: number) => {
        if (end > start) {
            const content = text.slice(start, end);
            if (content.length > 0) {
                const semantic = decodeHTMLEntity(content);
                result.push({
                    id: uuid(),
                    type: "text",
                    blockId,
                    text: {
                        symbolic: content,
                        semantic,
                    },
                    position: {
                        start: offset + start,
                        end: offset + end,
                    },
                });
            }
        }
    };

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
                const symbolic = text.slice(pos, pos + 2);
                result.push({
                    id: uuid(),
                    type: "text",
                    blockId,
                    text: { symbolic, semantic: escaped },
                    position: {
                        start: offset + pos,
                        end: offset + pos + 2,
                    },
                });
                pos += 2;
                textStart = pos;
                continue;
            }
            if (escaped === "\n") {
                addText(textStart, pos);
                result.push({
                    id: uuid(),
                    type: "hardBreak",
                    blockId,
                    text: {
                        symbolic: "\\\n",
                        semantic: "\n",
                    },
                    position: {
                        start: offset + pos,
                        end: offset + pos + 2,
                    },
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
                    text: {
                        symbolic: entityRaw,
                        semantic: decoded,
                    },
                    position: {
                        start: offset + pos,
                        end: offset + pos + entityRaw.length,
                    },
                    decoded,
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
                        
                        const symbolic = text.slice(pos, searchPos + backtickCount);
                        result.push({
                            id: uuid(),
                            type: "codeSpan",
                            blockId,
                            text: { symbolic, semantic: codeContent },
                            position: {
                                start: offset + pos,
                                end: offset + searchPos + backtickCount,
                            },
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
                const backtickText = "`".repeat(backtickCount);
                result.push({
                    id: uuid(),
                    type: "text",
                    blockId,
                    text: {
                        symbolic: backtickText,
                        semantic: backtickText,
                    },
                    position: {
                        start: offset + pos,
                        end: offset + pos + backtickCount,
                    },
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
                const url = autolinkMatch[1];
                result.push({
                    id: uuid(),
                    type: "autolink",
                    blockId,
                    text: {
                        symbolic: autolinkMatch[0],
                        semantic: url,
                    },
                    position: {
                        start: offset + pos,
                        end: offset + pos + autolinkMatch[0].length,
                    },
                    url,
                });
                pos += autolinkMatch[0].length;
                textStart = pos;
                continue;
            }

            const emailMatch = text.slice(pos).match(/^<([a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*)>/);
            if (emailMatch) {
                addText(textStart, pos);
                const email = emailMatch[1];
                const url = "mailto:" + email;
                result.push({
                    id: uuid(),
                    type: "autolink",
                    blockId,
                    text: {
                        symbolic: emailMatch[0],
                        semantic: email,
                    },
                    position: {
                        start: offset + pos,
                        end: offset + pos + emailMatch[0].length,
                    },
                    url,
                });
                pos += emailMatch[0].length;
                textStart = pos;
                continue;
            }

            const htmlMatch = text.slice(pos).match(/^<(\/?[a-zA-Z][a-zA-Z0-9]*\b[^>]*>|!--[\s\S]*?-->|!\[CDATA\[[\s\S]*?\]\]>|\?[^>]*\?>|![A-Z]+[^>]*>)/);
            if (htmlMatch) {
                addText(textStart, pos);
                const html = htmlMatch[0];
                result.push({
                    id: uuid(),
                    type: "rawHTML",
                    blockId,
                    text: {
                        symbolic: html,
                        semantic: html,
                    },
                    position: {
                        start: offset + pos,
                        end: offset + pos + html.length,
                    },
                });
                pos += html.length;
                textStart = pos;
                continue;
            }
        }

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
                const label = footnoteMatch[1];
                result.push({
                    id: uuid(),
                    type: "footnoteRef",
                    blockId,
                    text: {
                        symbolic: footnoteMatch[0],
                        semantic: label,
                    },
                    position: {
                        start: offset + pos,
                        end: offset + pos + footnoteMatch[0].length,
                    },
                    label,
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
                    const symbolic = text.slice(pos, closePos + 2);
                    result.push({
                        id: uuid(),
                        type: "strikethrough",
                        blockId,
                        text: {
                            symbolic,
                            semantic: innerText,
                        },
                        position: {
                            start: offset + pos,
                            end: offset + closePos + 2,
                        },
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
                    text: {
                        symbolic: delimText,
                        semantic: delimText,
                    },
                    position: {
                        start: offset + pos,
                        end: offset + pos + runLength,
                    },
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

        // // Hard line break: two+ spaces at end of line followed by newline
        // if (text[pos] === " ") {
        //     let spaceCount = 1;
        //     while (pos + spaceCount < text.length && text[pos + spaceCount] === " ") {
        //         spaceCount++;
        //     }
        //     if (spaceCount >= 2 && pos + spaceCount < text.length && text[pos + spaceCount] === "\n") {
        //         addText(textStart, pos);
        //         const symbolic = " ".repeat(spaceCount) + "\n";
        //         result.push({
        //             id: uuid(),
        //             type: "hardBreak",
        //             blockId,
        //             text: {
        //                 symbolic,
        //                 semantic: "\n",
        //             },
        //             position: {
        //                 start: offset + pos,
        //                 end: offset + pos + spaceCount + 1,
        //             },
        //         });
        //         pos += spaceCount + 1;
        //         textStart = pos;
        //         continue;
        //     }
        // }

        // if (text[pos] === "\n") {
        //     addText(textStart, pos);
        //     result.push({
        //         id: uuid(),
        //         type: "softBreak",
        //         blockId,
        //         text: {
        //             symbolic: "\n",
        //             semantic: "\n",
        //         },
        //         position: {
        //             start: offset + pos,
        //             end: offset + pos + 1,
        //         },
        //     });
        //     pos++;
        //     textStart = pos;
        //     continue;
        // }

        if (text[pos] === ":") {
            const emojiMatch = text.slice(pos).match(/^:([a-zA-Z0-9_+-]+):/);
            if (emojiMatch) {
                addText(textStart, pos);
                const name = emojiMatch[1];
                const symbolic = emojiMatch[0];
                result.push({
                    id: uuid(),
                    type: "emoji",
                    blockId,
                    text: {
                        symbolic,
                        semantic: symbolic,
                    },
                    position: {
                        start: offset + pos,
                        end: offset + pos + symbolic.length,
                    },
                    name,
                });
                pos += symbolic.length;
                textStart = pos;
                continue;
            }
        }

        pos++;
    }

    addText(textStart, pos);

    processEmphasis(delimiterStack, result, blockId);

    return result;
}

function parseLinkReferenceDefinitions(text: string) {
    // Match: [label]: url "optional title"
    const refRegex = /^\[([^\]]+)\]:\s*<?([^\s>]+)>?(?:\s+["'(]([^"')]+)["')])?$/gm;
    let match;
    while ((match = refRegex.exec(text)) !== null) {
        const label = match[1].toLowerCase().trim();
        const url = match[2];
        const title = match[3];
        // if (!linkReferences.has(label)) {
        //     linkReferences.set(label, { url, title });
        // }
    }
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
            const symbolic = text.slice(start, destResult.end);
            return {
                inline: {
                    id: uuid(),
                    type: "link",
                    blockId,
                    text: {
                        symbolic,
                        semantic: linkText,
                    },
                    position: {
                        start: offset + start,
                        end: offset + destResult.end,
                    },
                    url: destResult.url,
                    title: destResult.title,
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
    
    // const ref = linkReferences.get(refLabel);
    // if (ref) {
    //     return {
    //         inline: {
    //             id: uuid(),
    //             type: "link",
    //             blockId,
    //             text: {
    //                 symbolic: text.slice(start, refEnd),
    //                 semantic: linkText,
    //             },
    //             position: {
    //                 start: offset + start,
    //                 end: offset + refEnd,
    //             },
    //             url: ref.url,
    //             title: ref.title,
    //         },
    //         end: refEnd,
    //     };
    // }
    
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
            const symbolic = text.slice(start, destResult.end);
            return {
                inline: {
                    id: uuid(),
                    type: "image",
                    blockId,
                    text: {
                        symbolic,
                        semantic: altText,
                    },
                    position: {
                        start: offset + start,
                        end: offset + destResult.end,
                    },
                    url: destResult.url,
                    alt: altText,
                    title: destResult.title,
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
    
    // const ref = linkReferences.get(refLabel);
    // if (ref) {
    //     return {
    //         inline: {
    //             id: uuid(),
    //             type: "image",
    //             blockId,
    //             text: {
    //                 symbolic: text.slice(start, refEnd),
    //                 semantic: altText,
    //             },
    //             position: {
    //                 start: offset + start,
    //                 end: offset + refEnd,
    //             },
    //             url: ref.url,
    //             alt: altText,
    //             title: ref.title,
    //         },
    //         end: refEnd,
    //     };
    // }
    
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

    let current = 0;

    while (current < stack.length) {
        const closer = stack[current];
        if (!closer.canClose || !closer.active) {
            current++;
            continue;
        }

        let openerIndex = -1;
        for (let i = current - 1; i >= 0; i--) {
            const opener = stack[i];
            if (opener.type !== closer.type || !opener.canOpen || !opener.active) continue;

            if ((opener.length + closer.length) % 3 === 0 &&
                opener.length !== 1 && closer.length !== 1) {
                continue;
            }

            openerIndex = i;
            break;
        }

        if (openerIndex === -1) {
            current++;
            continue;
        }

        const opener = stack[openerIndex];
        const useLength = Math.min(opener.length, closer.length, 2);
        const isStrong = useLength === 2;
        const emphType = isStrong ? "strong" : "emphasis";
        const delimChar = opener.type;
        const delimStr = delimChar.repeat(useLength);

        const openerNodeIndex = opener.position;
        const closerNodeIndex = closer.position;

        const startIdx = openerNodeIndex;
        const endIdx = closerNodeIndex + 1;
        const affectedNodes = nodes.slice(startIdx, endIdx);

        let symbolic = delimStr;
        let semantic = '';
        for (const node of affectedNodes.slice(1, -1)) {
            symbolic += node.text.symbolic;
            semantic += node.text.semantic;
        }
        symbolic += delimStr;

        const emphNode: Inline = {
            id: uuid(),
            type: emphType,
            blockId,
            text: {
                symbolic,
                semantic,
            },
            position: {
                start: nodes[openerNodeIndex].position.start,
                end: nodes[closerNodeIndex].position.end
            },
        };

        const deleteCount = endIdx - startIdx;
        nodes.splice(startIdx, deleteCount, emphNode);

        stack.splice(current, 1);
        stack.splice(openerIndex, 1);

        const removedCount = deleteCount - 1;
        for (let i = 0; i < stack.length; i++) {
            if (stack[i].position >= startIdx + 1) {
                stack[i].position -= removedCount;
            }
        }

        current = startIdx;
    }
}



export function detectType(line: string): DetectedBlock {
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

export { buildAst }
