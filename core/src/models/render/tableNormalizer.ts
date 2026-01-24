function normalizeTables(rootElement: HTMLElement) {
    const tables = rootElement.querySelectorAll('table.table')
    
    tables.forEach(table => {
        const rows = table.querySelectorAll(':scope > tr.tableRow')

        let maxCells = 1
        rows.forEach(row => {
            const cellCount = row.querySelectorAll(':scope > td.tableCell').length
            if (cellCount > maxCells) maxCells = cellCount
        })
        
        ;(table as HTMLElement).dataset.maxCells = String(maxCells)

        rows.forEach(row => {
            const cells = row.querySelectorAll(':scope > td.tableCell')
            const rowCellCount = cells.length
            
            cells.forEach(cell => {
                if (rowCellCount === 1 && maxCells > 1) {
                    cell.setAttribute('colspan', String(maxCells))
                } else {
                    cell.removeAttribute('colspan')
                }
            })
        })
    })
}

export { normalizeTables }
