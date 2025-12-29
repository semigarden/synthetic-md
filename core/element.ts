import { SyntheticText } from './SyntheticText'

if (!customElements.get('synthetic-text')) {
    customElements.define('synthetic-text', SyntheticText)
}
