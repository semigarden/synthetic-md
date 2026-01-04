import Element from './models/element'

function defineElement() {
    if (!customElements.get('synthetic-text')) {
        customElements.define('synthetic-text', Element)
    }
}

export { defineElement }
