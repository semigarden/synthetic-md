let styled = false

export function injectStyles(cssText: string, id = 'synthetic-md-core-styles') {
    if (typeof document === 'undefined') return
    if (styled) return

    if (document.getElementById(id)) {
        styled = true
        return
    }

    const style = document.createElement('style')
    style.id = id
    style.textContent = cssText
    document.head.appendChild(style)
    styled = true
}
