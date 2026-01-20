import { Inline, Delimiter } from '../../../../types'
import { uuid } from '../../../../utils/utils'

class StrikethroughResolver {
    public apply(nodes: Inline[], delimiters: Delimiter[], blockId: string) {
        if (!delimiters.length) return

        let current = 0

        while (current < delimiters.length) {
            const closer = delimiters[current]

            if (
                closer.type !== '~' ||
                !closer.active ||
                !closer.canClose ||
                closer.position < 0 ||
                closer.position >= nodes.length
            ) {
                current++
                continue
            }

            const closerNode = nodes[closer.position]
            if (
                closerNode.type !== 'text' ||
                !closerNode.text.symbolic.includes('~')
            ) {
                closer.active = false
                current++
                continue
            }

            let openerIndex = -1
            for (let i = current - 1; i >= 0; i--) {
                const opener = delimiters[i]
                if (
                opener.type !== '~' ||
                !opener.active ||
                !opener.canOpen ||
                opener.position < 0 ||
                opener.position >= nodes.length
                ) continue

                const openerNode = nodes[opener.position]
                if (
                openerNode.type !== 'text' ||
                !openerNode.text.symbolic.includes('~')
                ) {
                opener.active = false
                continue
                }

                openerIndex = i
                break
            }

            if (openerIndex === -1) {
                current++
                continue
            }

            const opener = delimiters[openerIndex]

            const useLength = Math.min(opener.length, closer.length)
            if (useLength < 2) {
                current++
                continue
            }

            const startNodeIndex = opener.position
            const endNodeIndex = closer.position

            if (startNodeIndex > endNodeIndex) {
                opener.active = false
                closer.active = false
                current++
                continue
            }

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

            const strikeNode: Inline = {
                id: uuid(),
                type: 'strikethrough',
                blockId,
                text: { symbolic, semantic },
                position: {
                start: nodes[startNodeIndex].position.start,
                end: nodes[endNodeIndex].position.end,
                },
            } as Inline

            const deleteCount = endNodeIndex - startNodeIndex + 1
            nodes.splice(startNodeIndex, deleteCount, strikeNode)

            delimiters.splice(current, 1)
            delimiters.splice(openerIndex, 1)

            const removed = deleteCount - 1
            for (const d of delimiters) {
                if (d.position > startNodeIndex) d.position -= removed
            }

            current = startNodeIndex
        }
    }
}

export default StrikethroughResolver