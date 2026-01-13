import { LinkReference } from '../../../types'

class LinkReferenceState {
    private references = new Map<string, LinkReference>()

    public set(label: string, ref: LinkReference) {
        if (!this.references.has(label)) {
            this.references.set(label, ref)
        }
    }

    public get(label: string): LinkReference | undefined {
        return this.references.get(label.toLowerCase())
    }

    public reset() {
        this.references.clear()
    }
}

export default LinkReferenceState
