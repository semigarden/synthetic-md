import { buildTableBlock, isTableDivider } from './tableBuilder'
import { buildParagraph } from '../blockBuilders'
import type { Block } from '../../../../types'

type Table = {
    start: number
    headerLine: string
    dividerLine?: string
    rows: string[]
}

class TableParser {
    private table: Table | undefined

    public get hasPendingTable(): boolean {
        return !!this.table
    }

    public reset() {
        this.table = undefined
    }

    public tryStartTable(line: string, start: number): boolean {
        const trimmed = line.trim()
        if (/\|/.test(trimmed) && !isTableDivider(line)) {
            this.table = { start, headerLine: line, rows: [] }
            return true
        }
        return false
    }

    public feedLine(line: string, offset: number, reparseLine: () => Block[] | null): Block[] | null {
        if (!this.table) return reparseLine()

        const t = this.table

        if (!t.dividerLine) {
            if (isTableDivider(line)) {
                t.dividerLine = line
                return null
            }

            this.table = undefined
            const paragraph = buildParagraph(t.headerLine, t.start, t.start + t.headerLine.length)
            const current = reparseLine() ?? []
            return [paragraph, ...current]
        }

        if (/\|/.test(line)) {
            t.rows.push(line)
            return null
        }

        const tableBlock = buildTableBlock(t)
        this.table = undefined
        const current = reparseLine() ?? []
        return [tableBlock, ...current]
    }

    public flush(): Block[] | null {
        if (!this.table) return null
        const t = this.table
        this.table = undefined

        if (t.dividerLine) return [buildTableBlock(t)]

        return [buildParagraph(t.headerLine, t.start, t.start + t.headerLine.length)]
    }
}

export default TableParser
