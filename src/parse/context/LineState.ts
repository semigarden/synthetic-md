class LineState {
    text: string
    pos: number = 0

    constructor(text: string) {
        this.text = text
    }

    skipIndent(max = 3) {
        let count = 0
        while (count < max && this.peek() === " ") {
            this.advance(1)
            count++
        }
        return count
    }

    countIndent() {
        let count = 0
        let pos = this.pos
        while (pos < this.text.length && this.text[pos] === " ") {
            count++
            pos++
        }
        return count
    }

    peek(n = 1) {
        return this.text.slice(this.pos, this.pos + n)
    }

    currentIndex() {
        return this.pos
    }

    advance(n: number) {
        this.pos += n
    }

    remaining() {
        return this.text.slice(this.pos)
    }

    isBlank() {
        return this.remaining().trim() === ""
    }
}

export { LineState }
