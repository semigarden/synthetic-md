import { useRef } from "react";
import { uuid } from "../utils";
import useStore from "../hooks/useStore";

export type BlockType = "paragraph" | "heading" | "block-quote" | "list-item" | "empty";

export interface BlockContext {
    id: string
    type: BlockType
    text: string
    start: number
    end: number
}


export type InlineType = "text" | "strong" | "em" | "code" | "link" | "image" | "autolink" | "html" | "softbreak" | "hardbreak"

export interface InlineContext {
    id: string
    type: InlineType
    blockId: string
    synthetic: string
    pure: string
    start: number,
    end: number,
}

function useSynth() {
    const { saveText } = useStore()

    const allBlocks = useRef<BlockContext[]>([])
    const pureText = useRef<string>("")
  
    function parseBlocks(text: string): BlockContext[] {
        const lines = text.split("\n");
        const blocks: BlockContext[] = [];
        let offset = 0;
      
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const start = offset;
          const end = offset + line.length + 1; // +1 for \n (except last line)
      
          let type: BlockType = "paragraph";
      
          if (line.trim() === "") {
            type = "empty";
          } else if (line.startsWith("# ")) {
            type = "heading";
          } else if (line.startsWith("> ")) {
            type = "block-quote";
          } else if (line.match(/^\s*[-*+]\s/)) {
            type = "list-item";
          }
      
          blocks.push({
            id: uuid(),
            type,
            text: line,
            start,
            end: i === lines.length - 1 ? text.length : end, // last block ends at full length
          });
      
          offset = end;
        }
      
        if (blocks.length === 0) {
          blocks.push({
            id: uuid(),
            type: "empty",
            text: "",
            start: 0,
            end: 0,
          });
        }

        allBlocks.current = blocks;
      
        return blocks;
    }

    function parseInlines(block: BlockContext): InlineContext[] {
        const { text, id: blockId } = block;
    
        const inlines: InlineContext[] = [];
        let i = 0;
    
        while (i < text.length) {
            // 1. Code spans: `code`
            if (text[i] === "`") {
                const end = text.indexOf("`", i + 1);
                if (end !== -1) {
                    inlines.push({
                        id: uuid(),
                        type: "code",
                        blockId: blockId,
                        synthetic: text.slice(i + 1, end),
                        pure: text.slice(i, end + 1),
                        start: i,
                        end: end + 1,
                    });
                    i = end + 1;
                    continue;
                }
            }
    
            // 2. Bold: **
            if (text.slice(i, i + 2) === "**") {
                const end = text.indexOf("**", i + 2);
                if (end !== -1) {
                    inlines.push({
                        id: uuid(),
                        type: "strong",
                        blockId: blockId,
                        synthetic: text.slice(i + 2, end),
                        pure: text.slice(i, end + 2),
                        start: i,
                        end: end + 2,
                    });
                    i = end + 2;
                    continue;
                }
            }
    
            // 3. Italic: * (but not part of **)
            if (text[i] === "*" && (i === 0 || text[i - 1] !== "*")) {
                const end = text.indexOf("*", i + 1);
                if (end !== -1 && text.slice(i + 1, end).trim().length > 0) {
                    inlines.push({
                        id: uuid(),
                        type: "em",
                        blockId: blockId,
                        synthetic: text.slice(i + 1, end),
                        pure: text.slice(i, end + 1),
                        start: i,
                        end: end + 1,
                    });
                    i = end + 1;
                    continue;
                }
            }
    
            let next = text.length;
            for (const delim of ["**", "*", "`"]) {
                const pos = text.indexOf(delim, i + 1);
                if (pos !== -1 && pos < next) {
                    next = pos;
                }
            }
    
            if (next > i) {
                const content = text.slice(i, next);
                if (content.length > 0) {
                    inlines.push({
                        id: uuid(),
                        type: "text",
                        blockId: blockId,
                        synthetic: content,
                        pure: content,
                        start: i,
                        end: next,
                    });
                }
                i = next;
            } else {
                i++;
            }
        }
    
        return inlines;
    }
    

    const save = ((inline: InlineContext, blockId: string, text: string) => {
        const block = allBlocks.current.find((b: BlockContext) => b.id === blockId)
        console.log("newText", blockId, JSON.stringify(allBlocks.current, null, 2))
        if (!block) return;

        const newBlockText = block.text.slice(0, inline.start) + text + block.text.slice(inline.end)
        const newText = pureText.current.slice(0, block.start) + newBlockText + pureText.current.slice(block.end)

        console.log("newText", newText)
        saveText(newText)
        .catch((error) => console.error(error))
    })

    const setPureText = ((text: string) => {
        pureText.current = text;
    })

    console.log("pureText", pureText.current)

    return {
        parseBlocks,
        parseInlines,
        save,
        setPureText,
    }
}

export default useSynth;
