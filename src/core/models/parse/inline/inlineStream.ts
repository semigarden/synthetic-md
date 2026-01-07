

class InlineStream {
    private input: string
    private currentPosition = 0

    constructor(input: string) {
        this.input = input
    }

    public position(): number {
        return this.currentPosition
    }

    public end(): boolean {
        return this.currentPosition >= this.input.length
    }

    public peek(offset = 0): string | null {
        const i = this.currentPosition + offset
        return i < this.input.length ? this.input[i] : null
    }

    public next(): string | null {
        if (this.end()) return null
        return this.input[this.currentPosition++]
    }
    
    public slice(start: number = 0, end: number = this.input.length): string {
        return this.input.slice(start, end)
    }

    public consume(char: string): boolean {
        if (this.peek() === char) {
            this.currentPosition++
            return true
        }
        return false
    }

    public consumeWhile(predicate: (ch: string) => boolean): string {
        const start = this.currentPosition
        while (!this.end() && predicate(this.peek()!)) {
            this.currentPosition++
        }
        return this.input.slice(start, this.currentPosition)
    }

    public readUntil(predicate: (ch: string) => boolean): string {
        const start = this.currentPosition
        while (!this.end() && !predicate(this.peek()!)) {
            this.currentPosition++
        }
        return this.input.slice(start, this.currentPosition)
    }

    public match(value: string): boolean {
        return this.input.startsWith(value, this.currentPosition)
    }

    public consumeString(value: string): boolean {
        if (this.match(value)) {
            this.currentPosition += value.length
            return true
        }
        return false
    }

    public checkpoint(): number {
        return this.currentPosition
    }

    public restore(position: number) {
        this.currentPosition = position
    }

    public remaining(): string {
        return this.input.slice(this.currentPosition)
    }
}

export default InlineStream
