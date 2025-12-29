const uuid = (): string => {
    if (crypto.randomUUID) {
        return crypto.randomUUID()
    }

    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = (Math.random() * 16) | 0
        const v = c === 'x' ? r : (r & 0x3) | 0x8
        return v.toString(16)
    })
}

const namedEntities: Record<string, string> = {
    // Basic HTML entities
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&apos;": "'",
    
    // Common typographic entities
    "&nbsp;": "\u00A0",
    "&iexcl;": "¡",
    "&cent;": "¢",
    "&pound;": "£",
    "&curren;": "¤",
    "&yen;": "¥",
    "&brvbar;": "¦",
    "&sect;": "§",
    "&uml;": "¨",
    "&copy;": "©",
    "&ordf;": "ª",
    "&laquo;": "«",
    "&not;": "¬",
    "&shy;": "\u00AD",
    "&reg;": "®",
    "&macr;": "¯",
    "&deg;": "°",
    "&plusmn;": "±",
    "&sup2;": "²",
    "&sup3;": "³",
    "&acute;": "´",
    "&micro;": "µ",
    "&para;": "¶",
    "&middot;": "·",
    "&cedil;": "¸",
    "&sup1;": "¹",
    "&ordm;": "º",
    "&raquo;": "»",
    "&frac14;": "¼",
    "&frac12;": "½",
    "&frac34;": "¾",
    "&iquest;": "¿",
    
    // Math and symbols
    "&times;": "×",
    "&divide;": "÷",
    "&minus;": "−",
    "&lowast;": "∗",
    "&radic;": "√",
    "&prop;": "∝",
    "&infin;": "∞",
    "&ang;": "∠",
    "&and;": "∧",
    "&or;": "∨",
    "&cap;": "∩",
    "&cup;": "∪",
    "&int;": "∫",
    "&there4;": "∴",
    "&sim;": "∼",
    "&cong;": "≅",
    "&asymp;": "≈",
    "&ne;": "≠",
    "&equiv;": "≡",
    "&le;": "≤",
    "&ge;": "≥",
    "&sub;": "⊂",
    "&sup;": "⊃",
    "&nsub;": "⊄",
    "&sube;": "⊆",
    "&supe;": "⊇",
    "&oplus;": "⊕",
    "&otimes;": "⊗",
    "&perp;": "⊥",
    "&sdot;": "⋅",
    
    // Greek letters
    "&Alpha;": "Α",
    "&Beta;": "Β",
    "&Gamma;": "Γ",
    "&Delta;": "Δ",
    "&Epsilon;": "Ε",
    "&Zeta;": "Ζ",
    "&Eta;": "Η",
    "&Theta;": "Θ",
    "&Iota;": "Ι",
    "&Kappa;": "Κ",
    "&Lambda;": "Λ",
    "&Mu;": "Μ",
    "&Nu;": "Ν",
    "&Xi;": "Ξ",
    "&Omicron;": "Ο",
    "&Pi;": "Π",
    "&Rho;": "Ρ",
    "&Sigma;": "Σ",
    "&Tau;": "Τ",
    "&Upsilon;": "Υ",
    "&Phi;": "Φ",
    "&Chi;": "Χ",
    "&Psi;": "Ψ",
    "&Omega;": "Ω",
    "&alpha;": "α",
    "&beta;": "β",
    "&gamma;": "γ",
    "&delta;": "δ",
    "&epsilon;": "ε",
    "&zeta;": "ζ",
    "&eta;": "η",
    "&theta;": "θ",
    "&iota;": "ι",
    "&kappa;": "κ",
    "&lambda;": "λ",
    "&mu;": "μ",
    "&nu;": "ν",
    "&xi;": "ξ",
    "&omicron;": "ο",
    "&pi;": "π",
    "&rho;": "ρ",
    "&sigmaf;": "ς",
    "&sigma;": "σ",
    "&tau;": "τ",
    "&upsilon;": "υ",
    "&phi;": "φ",
    "&chi;": "χ",
    "&psi;": "ψ",
    "&omega;": "ω",
    
    // Arrows
    "&larr;": "←",
    "&uarr;": "↑",
    "&rarr;": "→",
    "&darr;": "↓",
    "&harr;": "↔",
    "&crarr;": "↵",
    "&lArr;": "⇐",
    "&uArr;": "⇑",
    "&rArr;": "⇒",
    "&dArr;": "⇓",
    "&hArr;": "⇔",
    
    // Punctuation and special
    "&ndash;": "\u2013",
    "&mdash;": "\u2014",
    "&lsquo;": "\u2018",
    "&rsquo;": "\u2019",
    "&sbquo;": "\u201A",
    "&ldquo;": "\u201C",
    "&rdquo;": "\u201D",
    "&bdquo;": "\u201E",
    "&dagger;": "†",
    "&Dagger;": "‡",
    "&bull;": "•",
    "&hellip;": "…",
    "&permil;": "‰",
    "&prime;": "′",
    "&Prime;": "″",
    "&lsaquo;": "‹",
    "&rsaquo;": "›",
    "&oline;": "‾",
    "&frasl;": "⁄",
    "&euro;": "€",
    "&trade;": "™",
    "&alefsym;": "ℵ",
    "&spades;": "♠",
    "&clubs;": "♣",
    "&hearts;": "♥",
    "&diams;": "♦",
    
    // Additional entities
    "&OElig;": "Œ",
    "&oelig;": "œ",
    "&Scaron;": "Š",
    "&scaron;": "š",
    "&Yuml;": "Ÿ",
    "&fnof;": "ƒ",
    "&circ;": "ˆ",
    "&tilde;": "˜",
    "&ensp;": "\u2002",
    "&emsp;": "\u2003",
    "&thinsp;": "\u2009",
    "&zwnj;": "\u200C",
    "&zwj;": "\u200D",
    "&lrm;": "\u200E",
    "&rlm;": "\u200F",
    
    // Latin Extended
    "&Agrave;": "À",
    "&Aacute;": "Á",
    "&Acirc;": "Â",
    "&Atilde;": "Ã",
    "&Auml;": "Ä",
    "&Aring;": "Å",
    "&AElig;": "Æ",
    "&Ccedil;": "Ç",
    "&Egrave;": "È",
    "&Eacute;": "É",
    "&Ecirc;": "Ê",
    "&Euml;": "Ë",
    "&Igrave;": "Ì",
    "&Iacute;": "Í",
    "&Icirc;": "Î",
    "&Iuml;": "Ï",
    "&ETH;": "Ð",
    "&Ntilde;": "Ñ",
    "&Ograve;": "Ò",
    "&Oacute;": "Ó",
    "&Ocirc;": "Ô",
    "&Otilde;": "Õ",
    "&Ouml;": "Ö",
    "&Oslash;": "Ø",
    "&Ugrave;": "Ù",
    "&Uacute;": "Ú",
    "&Ucirc;": "Û",
    "&Uuml;": "Ü",
    "&Yacute;": "Ý",
    "&THORN;": "Þ",
    "&szlig;": "ß",
    "&agrave;": "à",
    "&aacute;": "á",
    "&acirc;": "â",
    "&atilde;": "ã",
    "&auml;": "ä",
    "&aring;": "å",
    "&aelig;": "æ",
    "&ccedil;": "ç",
    "&egrave;": "è",
    "&eacute;": "é",
    "&ecirc;": "ê",
    "&euml;": "ë",
    "&igrave;": "ì",
    "&iacute;": "í",
    "&icirc;": "î",
    "&iuml;": "ï",
    "&eth;": "ð",
    "&ntilde;": "ñ",
    "&ograve;": "ò",
    "&oacute;": "ó",
    "&ocirc;": "ô",
    "&otilde;": "õ",
    "&ouml;": "ö",
    "&oslash;": "ø",
    "&ugrave;": "ù",
    "&uacute;": "ú",
    "&ucirc;": "û",
    "&uuml;": "ü",
    "&yacute;": "ý",
    "&thorn;": "þ",
    "&yuml;": "ÿ",
};

/**
 * Supports:
 * - Named character references (e.g., &amp;, &copy;)
 * - Decimal numeric character references (e.g., &#160;)
 * - Hexadecimal numeric character references (e.g., &#xA0;)
 */
function decodeHTMLEntity(text: string): string {
    // First handle named entities
    for (const [entity, char] of Object.entries(namedEntities)) {
        if (text.includes(entity)) {
            text = text.replaceAll(entity, char);
        }
    }

    // Handle decimal numeric references &#N; where N is 1-7 digits
    text = text.replace(/&#(\d{1,7});/g, (_match, num) => {
        const codePoint = parseInt(num, 10);
        // Invalid code points (0, surrogates, > 0x10FFFF) become replacement char
        if (codePoint === 0 || 
            (codePoint >= 0xD800 && codePoint <= 0xDFFF) || 
            codePoint > 0x10FFFF) {
            return "\uFFFD";
        }
        try {
            return String.fromCodePoint(codePoint);
        } catch {
            return "\uFFFD";
        }
    });

    // Handle hexadecimal numeric references &#xN; or &#XN; where N is 1-6 hex digits
    text = text.replace(/&#[xX]([0-9a-fA-F]{1,6});/g, (_match, hex) => {
        const codePoint = parseInt(hex, 16);
        // Invalid code points become replacement char
        if (codePoint === 0 || 
            (codePoint >= 0xD800 && codePoint <= 0xDFFF) || 
            codePoint > 0x10FFFF) {
            return "\uFFFD";
        }
        try {
            return String.fromCodePoint(codePoint);
        } catch {
            return "\uFFFD";
        }
    });

    return text;
}

/**
 * Check if a string contains an HTML entity
 */
function containsHTMLEntity(text: string): boolean {
    return /&(?:#[xX]?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/.test(text);
}

/**
 * Encode special characters as HTML entities
 */
function encodeHTMLEntities(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

export { uuid, decodeHTMLEntity, containsHTMLEntity, encodeHTMLEntities };
