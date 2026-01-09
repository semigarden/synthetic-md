import InlineStream from "../inlineStream"
import { Inline } from "../../../../types"
import { uuid } from "../../../../utils/utils"

class MarkerResolver {
    public tryParse(
        stream: InlineStream,
        text: string,
        blockId: string,
        blockType: string,
        position: number
    ): Inline | null {
        if (stream.position() !== 0) return null

        if (blockType === 'heading') {
            const match = text.match(/^(#{1,6})(\s+|$)/)
            if (!match) return null

            const markerText = match[1] + (match[2] ? ' ' : '')
            const length = markerText.length

            stream.advance(length)

            return {
                id: uuid(),
                type: 'marker',
                blockId,
                text: { symbolic: markerText, semantic: '' },
                position: {
                    start: position,
                    end: position + length
                }
            }
        }

        if (blockType === 'thematicBreak') {
            const match = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/.test(text)
            if (!match) return null

            stream.advance(text.length)

            return {
                id: uuid(),
                type: 'marker',
                blockId,
                text: { symbolic: text, semantic: '' },
                position: {
                    start: position,
                    end: position + text.length
                }
            }
        }

        if (blockType === 'listItem') {
            const unorderedListMatch = /^\s*([-*+])\s+/.exec(text);
            if (unorderedListMatch) {
                stream.advance(text.length)

                return {
                    id: uuid(),
                    type: 'marker',
                    blockId,
                    text: { symbolic: unorderedListMatch[0], semantic: '' },
                    position: {
                        start: position,
                        end: position + text.length
                    }
                }
            }
        
            const orderedListMatch = /^\s*(\d{1,9})([.)])\s+/.exec(text);
            if (orderedListMatch) {
                stream.advance(text.length)

                return {
                    id: uuid(),
                    type: 'marker',
                    blockId,
                    text: { symbolic: orderedListMatch[0], semantic: '' },
                    position: {
                        start: position,
                        end: position + text.length
                    }
                }
            }

            return null
        }

        return null
    }
}

export default MarkerResolver
