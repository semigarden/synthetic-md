/**
 * Link destination can be:
 * - A sequence of zero or more characters between < and > that contains no line endings or unescaped < or >
 * - A nonempty sequence of characters not starting with <, not including ASCII control/space, 
 *   with balanced parentheses and backslash escapes
 * 
 * Link title can be:
 * - A sequence of zero or more characters between straight double-quotes (")
 * - A sequence of zero or more characters between straight single-quotes (')
 * - A sequence of zero or more characters between matching parentheses ((...))
 */
function parseLinkDestinationAndTitle(
    text: string,
    start: number,
): { url: string; title?: string; end: number } | null {
    let pos = start
    if (pos >= text.length || text[pos] !== "(") return null
    pos++

    // Skip optional whitespace (including newlines for multiline)
    while (pos < text.length && /[ \t\n]/.test(text[pos])) pos++
    if (pos >= text.length) return null

    let url = ""
    
    // Angle-bracketed destination: <url>
    if (text[pos] === "<") {
        pos++
        const urlStart = pos
        while (pos < text.length) {
            if (text[pos] === ">") {
                url = text.slice(urlStart, pos)
                pos++
                break
            }
            if (text[pos] === "\n" || text[pos] === "<") {
                // Invalid: line ending or unescaped < in angle-bracketed URL
                return null
            }
            if (text[pos] === "\\") {
                // Backslash escape - skip next character
                pos += 2
                continue
            }
            pos++
        }
        if (url === "" && text[pos - 1] !== ">") return null
    } else {
        // Unbracketed destination - must handle balanced parentheses
        const urlStart = pos
        let parenDepth = 0
        
        while (pos < text.length) {
            const ch = text[pos]
            
            // Backslash escape
            if (ch === "\\") {
                pos += 2
                continue
            }
            
            // ASCII control characters or space end the URL (unless in parens)
            if (/[ \t\n]/.test(ch) && parenDepth === 0) break
            
            // ASCII control characters (0x00-0x1F) are not allowed
            if (ch.charCodeAt(0) <= 0x1F) break
            
            if (ch === "(") {
                parenDepth++
            } else if (ch === ")") {
                if (parenDepth === 0) break
                parenDepth--
            }
            
            pos++
        }
        
        url = text.slice(urlStart, pos)
        
        // Process backslash escapes in URL
        url = processEscapes(url)
    }

    // Skip optional whitespace
    while (pos < text.length && /[ \t\n]/.test(text[pos])) pos++

    // Optional title
    let title: string | undefined = undefined
    
    if (pos < text.length && (text[pos] === '"' || text[pos] === "'" || text[pos] === "(")) {
        const openChar = text[pos]
        const closeChar = openChar === "(" ? ")" : openChar
        pos++
        const titleStart = pos
        
        while (pos < text.length) {
            if (text[pos] === "\\") {
                pos += 2
                continue
            }
            if (text[pos] === closeChar) {
                title = processEscapes(text.slice(titleStart, pos))
                pos++
                break
            }
            // Titles can span multiple lines
            pos++
        }
        
        if (title === undefined) return null  // No closing quote found
    }

    // Skip optional whitespace
    while (pos < text.length && /[ \t\n]/.test(text[pos])) pos++

    // Must end with )
    if (pos >= text.length || text[pos] !== ")") return null
    pos++

    return { url, title, end: pos }
}

/**
 * Process backslash escapes in a string
 * CommonMark allows escaping ASCII punctuation characters
 */
function processEscapes(text: string): string {
    return text.replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g, "$1")
}

/**
 * Parse a link reference definition
 * [label]: destination "title"
 * 
 * These are block-level elements but parsed during inline phase
 */
function parseLinkReferenceDefinition(
    text: string,
    start: number = 0
): { label: string; url: string; title?: string; end: number } | null {
    let pos = start
    
    // Skip up to 3 spaces of indentation
    let indent = 0
    while (pos < text.length && text[pos] === " " && indent < 3) {
        pos++
        indent++
    }
    
    // Must start with [
    if (pos >= text.length || text[pos] !== "[") return null
    pos++
    
    // Parse label (up to 999 characters, no unescaped brackets)
    const labelStart = pos
    let labelLength = 0
    while (pos < text.length && labelLength < 999) {
        if (text[pos] === "\\") {
            pos += 2
            labelLength += 2
            continue
        }
        if (text[pos] === "]") break
        if (text[pos] === "[") return null  // Unescaped [
        pos++
        labelLength++
    }
    
    if (pos >= text.length || text[pos] !== "]") return null
    const label = text.slice(labelStart, pos).trim()
    if (label.length === 0) return null
    pos++
    
    // Must have colon
    if (pos >= text.length || text[pos] !== ":") return null
    pos++
    
    // Skip optional whitespace (can include one newline)
    let hasNewline = false
    while (pos < text.length && /[ \t]/.test(text[pos])) pos++
    if (pos < text.length && text[pos] === "\n") {
        pos++
        hasNewline = true
        while (pos < text.length && /[ \t]/.test(text[pos])) pos++
    }
    
    // Parse destination
    let url = ""
    
    if (pos < text.length && text[pos] === "<") {
        // Angle-bracketed destination
        pos++
        const urlStart = pos
        while (pos < text.length && text[pos] !== ">" && text[pos] !== "\n") {
            if (text[pos] === "\\") pos++
            pos++
        }
        if (pos >= text.length || text[pos] !== ">") return null
        url = processEscapes(text.slice(urlStart, pos))
        pos++
    } else {
        // Plain destination
        const urlStart = pos
        let parenDepth = 0
        while (pos < text.length) {
            const ch = text[pos]
            if (ch === "\\") {
                pos += 2
                continue
            }
            if (/[ \t\n]/.test(ch) && parenDepth === 0) break
            if (ch === "(") parenDepth++
            if (ch === ")") {
                if (parenDepth === 0) break
                parenDepth--
            }
            pos++
        }
        url = processEscapes(text.slice(urlStart, pos))
    }
    
    if (url.length === 0) return null
    
    // Skip whitespace (but not newline yet for title check)
    const beforeTitlePos = pos
    while (pos < text.length && /[ \t]/.test(text[pos])) pos++
    
    // Optional title (must be on same line or next line)
    let title: string | undefined
    
    if (pos < text.length && text[pos] === "\n") {
        pos++
        while (pos < text.length && /[ \t]/.test(text[pos])) pos++
    }
    
    if (pos < text.length && (text[pos] === '"' || text[pos] === "'" || text[pos] === "(")) {
        const openChar = text[pos]
        const closeChar = openChar === "(" ? ")" : openChar
        pos++
        const titleStart = pos
        
        while (pos < text.length) {
            if (text[pos] === "\\") {
                pos += 2
                continue
            }
            if (text[pos] === closeChar) {
                title = processEscapes(text.slice(titleStart, pos))
                pos++
                break
            }
            if (text[pos] === "\n" && openChar !== "(") {
                // Titles in quotes can't span lines
                pos = beforeTitlePos
                title = undefined
                break
            }
            pos++
        }
    }
    
    // Skip trailing whitespace
    while (pos < text.length && /[ \t]/.test(text[pos])) pos++
    
    // Must be at end of line or end of string
    if (pos < text.length && text[pos] !== "\n") {
        // Not a valid link reference definition
        return null
    }
    
    if (pos < text.length && text[pos] === "\n") pos++
    
    return { label: label.toLowerCase(), url, title, end: pos }
}

export { parseLinkDestinationAndTitle, parseLinkReferenceDefinition, processEscapes }
