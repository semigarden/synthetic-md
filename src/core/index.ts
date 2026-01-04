import { SyntheticText } from './visual/SyntheticText'

function defineSyntheticText() {
    if (!customElements.get('synthetic-text')) {
        customElements.define('synthetic-text', SyntheticText)
    }
}

export { defineSyntheticText }
