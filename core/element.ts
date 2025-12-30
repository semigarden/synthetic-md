import { SyntheticText } from './visual/SyntheticText'

if (!customElements.get('synthetic-text')) {
    customElements.define('synthetic-text', SyntheticText)
}
