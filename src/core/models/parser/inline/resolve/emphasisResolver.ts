import { Inline, Delimiter } from '../../../../types'
import { uuid } from '../../../../utils/utils'

class EmphasisResolver {
    public apply(nodes: Inline[], delimiters: Delimiter[], blockId: string) {
        if (!delimiters.length) return

        let current = 0

        while (current < delimiters.length) {
            const closer = delimiters[current]
            if (
                (closer.type !== '*' && closer.type !== '_') ||
                !closer.canClose ||
                !closer.active
            ) {
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

                if ((opener.length + closer.length) % 3 === 0 &&
                    opener.length !== 1 && closer.length !== 1) continue

                openerIndex = i
                break
            }

            if (openerIndex === -1) {
                current++
                continue
            }

            const opener = delimiters[openerIndex]
            const useLength = Math.min(opener.length, closer.length, 2);
            const type = useLength === 2 ? 'strong' : 'emphasis'

            const startNodeIndex = opener.position
            const endNodeIndex = closer.position

            const affected = nodes.slice(startNodeIndex, endNodeIndex + 1)

            let symbolic = ''
            let semantic = ''

            for (let i = 0; i < affected.length; i++) {
                const node = affected[i]
                symbolic += node.text.symbolic

                if (i > 0 && i < affected.length - 1) {
                    semantic += node.text.semantic
                }
            }

            const emphasisNode = {
                id: uuid(),
                type,
                blockId,
                text: { symbolic, semantic },
                position: {
                    start: nodes[startNodeIndex].position.start,
                    end: nodes[endNodeIndex].position.end,
                }
            } as Inline

            if (
                opener.position < 0 ||
                closer.position < 0 ||
                opener.position >= nodes.length ||
                closer.position >= nodes.length ||
                opener.position > closer.position
            ) {
                closer.active = false
                current++
                continue
            }

            const deleteCount = endNodeIndex - startNodeIndex + 1
            nodes.splice(startNodeIndex, deleteCount, emphasisNode)

            opener.length -= useLength
            closer.length -= useLength

            if (opener.length === 0) opener.active = false
            if (closer.length === 0) closer.active = false

            const start = startNodeIndex
            const end = endNodeIndex

            for (const d of delimiters) {
                if (d.position >= start && d.position <= end) {
                    d.active = false
                }
            }

            const removed = deleteCount - 1
            for (const d of delimiters) {
                if (d.position > startNodeIndex) {
                    d.position -= removed
                }
            }

            current = startNodeIndex;
        }
    }
}

export default EmphasisResolver
