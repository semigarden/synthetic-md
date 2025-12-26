import { useRef } from "react";
import { uuid } from "../utils";
import useStore from "./useStore";

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

    function detectType(line: string): BlockType {
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

        return type;
    }

    const inlineCache = useRef(new Map<string, InlineContext[]>()).current;

    const allBlocks = useRef<BlockContext[]>([])
    const pureText = useRef<string>("")
  
    function parseBlocks(text: string): BlockContext[] {
      const prev = allBlocks.current;
      const lines = text.split("\n");
    
      let offset = 0;
      const nextBlocks: BlockContext[] = [];
    
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
    
        const start = offset;
        const end =
          i === lines.length - 1
            ? text.length
            : offset + line.length + 1;
    
        const type = line === "" ? "paragraph" : detectType(line);
    
        // collapse consecutive empty paragraphs
        if (line === "" && nextBlocks.at(-1)?.text === "") {
          offset = end;
          continue;
        }
    
        const prevBlock = prev.find(
          b => b.start === start && b.type === type
        );
    
        nextBlocks.push({
          id: prevBlock?.id ?? uuid(),
          type,
          text: line,
          start,
          end,
        });
    
        offset = end;
      }
    
      allBlocks.current = nextBlocks;
      pureText.current = text;
      return nextBlocks;
    }

    function parseInlines(block: BlockContext): InlineContext[] {
        const prev = inlineCache.get(block.id) ?? [];
        const next: InlineContext[] = [];
      
        let i = 0;
        let reuseIndex = 0;
      
        const reuse = (
          type: InlineType,
          start: number,
          end: number,
          synthetic: string,
          pure: string
        ): InlineContext => {
          const candidate = prev[reuseIndex];
      
          if (
            candidate &&
            candidate.type === type &&
            candidate.start === start &&
            candidate.end === end
          ) {
            reuseIndex++;
            return {
              ...candidate,
              synthetic,
              pure,
            };
          }
      
          reuseIndex++;
          return {
            id: uuid(),
            type,
            blockId: block.id,
            synthetic,
            pure,
            start,
            end,
          };
        };
      
        while (i < block.text.length) {
          const text = block.text;
      
          // code span
          if (text[i] === "`") {
            const end = text.indexOf("`", i + 1);
            if (end !== -1) {
              next.push(
                reuse(
                  "code",
                  i,
                  end + 1,
                  text.slice(i + 1, end),
                  text.slice(i, end + 1)
                )
              );
              i = end + 1;
              continue;
            }
          }
      
          // strong **
          if (text.slice(i, i + 2) === "**") {
            const end = text.indexOf("**", i + 2);
            if (end !== -1) {
              next.push(
                reuse(
                  "strong",
                  i,
                  end + 2,
                  text.slice(i + 2, end),
                  text.slice(i, end + 2)
                )
              );
              i = end + 2;
              continue;
            }
          }
      
          // em *
          if (text[i] === "*" && text[i - 1] !== "*") {
            const end = text.indexOf("*", i + 1);
            if (end !== -1) {
              next.push(
                reuse(
                  "em",
                  i,
                  end + 1,
                  text.slice(i + 1, end),
                  text.slice(i, end + 1)
                )
              );
              i = end + 1;
              continue;
            }
          }
      
          // plain text
          let nextDelim = text.length;
          for (const d of ["**", "*", "`"]) {
            const p = text.indexOf(d, i + 1);
            if (p !== -1 && p < nextDelim) nextDelim = p;
          }
      
          if (nextDelim > i) {
            next.push(
              reuse(
                "text",
                i,
                nextDelim,
                text.slice(i, nextDelim),
                text.slice(i, nextDelim)
              )
            );
            i = nextDelim;
          } else {
            i++;
          }
        }
      
        inlineCache.set(block.id, next);
        return next;
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

    function rangeFromMouse(e: MouseEvent): Range | null {
        if (document.caretRangeFromPoint) {
          return document.caretRangeFromPoint(e.clientX, e.clientY)
        }
      
        const pos = document.caretPositionFromPoint?.(e.clientX, e.clientY)
        if (!pos) return null
      
        const r = document.createRange()
        r.setStart(pos.offsetNode, pos.offset)
        r.collapse(true)
        return r
    }

    function rangeToOffset(container: HTMLElement, range: Range): number {
        const pre = document.createRange()
        pre.selectNodeContents(container)
        pre.setEnd(range.startContainer, range.startOffset)
        return pre.toString().length
    }

    return {
        parseBlocks,
        parseInlines,
        save,
        setPureText,
        rangeFromMouse,
        rangeToOffset,
    } as const
}

export default useSynth;
