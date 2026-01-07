import { Inline, Delimiter } from '../../../../types'
import { uuid } from '../../../../utils/utils'

class EmphasisResolver {
    public apply(
        nodes: Inline[],
        delimiters: Delimiter[],
        blockId: string
    ) {
        if (delimiters.length === 0) return

        let current = 0

        while (current < delimiters.length) {
            const closer = delimiters[current]

            if (!closer.canClose || !closer.active) {
                current++
                continue
            }

            let openerIndex = -1

            for (let i = current - 1; i >= 0; i--) {
                const opener = delimiters[i]

                if (
                    opener.type !== closer.type ||
                    !opener.canOpen ||
                    !opener.active
                ) continue

                if (
                    (opener.length + closer.length) % 3 === 0 &&
                    opener.length !== 1 &&
                    closer.length !== 1
                ) continue

                openerIndex = i
                break
            }

            if (openerIndex === -1) {
                current++
                continue
            }

            const opener = delimiters[openerIndex]

            const useLength = Math.min(opener.length, closer.length, 2)
            const isStrong = useLength === 2
            const type = isStrong ? 'strong' : 'emphasis'

            const startNodeIndex = opener.position
            const endNodeIndex = closer.position

            const affected = nodes.slice(startNodeIndex, endNodeIndex + 1)
            const innerNodes = affected.slice(1, -1)

            const symbolic = affected.map(n => n.text.symbolic).join('')
            const semantic = innerNodes.map(n => n.text.semantic).join('')

            const emphNode: Inline = {
                id: uuid(),
                type,
                blockId,
                text: { symbolic, semantic },
                position: {
                    start: nodes[startNodeIndex].position.start,
                    end: nodes[endNodeIndex].position.end,
                },
            }

            const deleteCount = endNodeIndex - startNodeIndex + 1
            nodes.splice(startNodeIndex, deleteCount, emphNode)

            delimiters.splice(current, 1)
            delimiters.splice(openerIndex, 1)

            const removed = deleteCount - 1
            for (const d of delimiters) {
                if (d.position > startNodeIndex) {
                    d.position -= removed
                }
            }

            current = startNodeIndex
        }
    }
}

export default EmphasisResolver
