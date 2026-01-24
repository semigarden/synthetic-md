// This file is auto-generated. Do not edit manually
// Run 'npm run build:css-ts' to regenerate

const cssText = `@charset "UTF-8";
:host {
  width: 100%;
  height: 100%;
}

.element {
  --color-background: #110f16;
  --color-background-area: #181424;
  --color-border: #2a2340;
  --color-text: #d4cfee;
  --color-muted: #8b85a3;
  --color-accent: #4a9eff;
  --color-code-bg: #1a1625;
  --color-blockquote-border: #4a9eff;
  --color-selection-bg: #2a2340;
  position: relative;
  width: 100%;
  height: 100%;
  align-items: stretch;
  justify-content: flex-start;
  resize: none;
  border: none;
  outline: none;
  white-space: pre-wrap;
  font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
  font-size: 16px;
  line-height: 1.6;
}

.selection {
  background: var(--color-selection-bg);
}

.block {
  margin: 0;
  padding: 0;
  min-height: 1.2em;
}

.inline {
  position: relative;
  white-space: pre-wrap;
  word-break: break-word;
  word-wrap: break-word;
  overflow-wrap: break-word;
  text-overflow: ellipsis;
  max-width: 100%;
  height: auto;
  display: inline-block;
  text-align: left;
  outline: none;
}
.inline .symbolic {
  position: relative;
}
.inline .semantic {
  pointer-events: none;
  user-select: none;
  opacity: 1;
}
.inline:not(.focused) .symbolic {
  position: absolute;
  inset: 0;
  color: transparent;
  caret-color: transparent;
}
.inline:not(.focused) .semantic {
  position: relative;
}
.inline.focused .symbolic {
  position: relative;
  color: inherit;
  caret-color: auto;
  cursor: text;
}
.inline.focused .semantic {
  position: absolute;
  inset: 0;
  opacity: 0;
  user-select: none;
  pointer-events: none;
}
.inline.focused .image {
  display: none;
}

.paragraph {
  margin: 0;
}

.heading {
  font-weight: 600;
  margin: 0.75em 0 0.25em;
  line-height: 1.3;
}

.h1 {
  font-size: 2em;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 0.25em;
  margin: 0;
}

.h2 {
  font-size: 1.5em;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 0.2em;
}

.h3 {
  font-size: 1.25em;
}

.h4 {
  font-size: 1.1em;
}

.h5 {
  font-size: 1em;
}

.h6 {
  font-size: 0.9em;
  color: var(--color-muted);
}

.blockQuote {
  border-left: 3px solid var(--color-blockquote-border);
  padding-left: 1em;
  margin: 0.5em 0;
  color: var(--color-muted);
  font-style: italic;
}

.codeBlock {
  background: var(--color-code-bg);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 0 1em;
  margin: 0.5em 0;
  overflow-x: auto;
  position: relative;
  transition: border-color 0.15s ease;
}
.codeBlock code {
  display: flex;
  flex-direction: column;
  font-family: "JetBrains Mono", "Fira Code", "Consolas", monospace;
  font-size: 0.9em;
  line-height: 1.5;
  color: var(--color-text);
}
.codeBlock .marker {
  opacity: 0;
}
.codeBlock .marker.focused {
  opacity: 1;
}
.codeBlock .marker .symbolic {
  position: relative;
  color: inherit;
}
.codeBlock .inline[data-type=text] {
  white-space: pre-wrap;
  word-break: break-all;
}
.codeBlock .inline[data-type=text].focused {
  background: transparent;
  outline: none;
}
.codeBlock .inline[data-type=text] .symbolic {
  position: relative;
  color: inherit;
}
.codeBlock .inline[data-type=text] .semantic {
  display: none;
}
.codeBlock[data-language]::before {
  content: attr(data-language);
  position: absolute;
  top: 0.5em;
  right: 0.75em;
  font-size: 0.75em;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  pointer-events: none;
}

.list {
  margin: 0;
  padding-left: 1.5em;
}
.list[start] {
  list-style-type: decimal;
}

.listItem {
  display: list-item;
  margin: 0;
}
.listItem .markerAnchor {
  display: inline;
  width: 0;
  height: 0;
  pointer-events: none;
}

.taskListItem {
  list-style: none;
  margin-left: -1.5em;
  display: flex;
  align-items: center;
  gap: 0.1em;
}

.taskCheckbox {
  margin-top: 0.35em;
  margin-left: 0.5em;
  width: 1em;
  height: 1em;
  accent-color: var(--color-accent);
  cursor: pointer;
}

.taskContent {
  flex: 1;
}

.thematicBreak {
  position: relative;
  border: none;
}
.thematicBreak::after {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  margin: auto;
  width: 100%;
  height: 1px;
  background-color: var(--color-border);
}
.thematicBreak.focused::after {
  display: none;
}

.table {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  margin: 0.5em 0;
  border: 1px solid var(--color-border);
}

.tableRow,
.tableCell {
  border: 1px solid var(--color-border);
  padding: 0.5em 1em;
  text-align: left;
}

.htmlBlock {
  margin: 0.5em 0;
}

.footnote {
  font-size: 0.9em;
  color: var(--color-muted);
  margin: 0.25em 0;
  padding-left: 2em;
  position: relative;
}

.footnoteLabel {
  position: absolute;
  left: 0;
  color: var(--color-accent);
}

.footnoteContent {
  display: inline;
}

.blankLine {
  height: 1.2em;
  user-select: none;
}

.link, .autolink {
  cursor: pointer;
}

.caret {
  position: absolute;
  width: 1px;
  height: 1em;
  background-color: #fff;
  animation: blink 1s step-end infinite;
  pointer-events: none;
  z-index: 10;
}

.inline {
  outline: none;
  white-space: pre-wrap;
  word-break: break-word;
}
.inline.focus {
  background: rgba(0, 120, 255, 0.1);
  border-radius: 3px;
  padding: 0 2px;
  min-height: 1.2em;
  outline: 1px solid var(--color-accent);
}
.inline[data-type=strong]:not(.focus) {
  font-weight: bold;
}
.inline[data-type=emphasis]:not(.focus) {
  font-style: italic;
}
.inline[data-type=codeSpan]:not(.focus) {
  font-family: "JetBrains Mono", "Fira Code", monospace;
  font-size: 0.9em;
  background: var(--color-code-bg);
  padding: 0.15em 0.4em;
  border-radius: 3px;
}
.inline[data-type=link]:not(.focus) {
  color: var(--color-accent);
  text-decoration: underline;
  cursor: pointer;
}
.inline[data-type=autolink]:not(.focus) {
  color: var(--color-accent);
  text-decoration: underline;
}
.inline[data-type=strikethrough]:not(.focus) {
  text-decoration: line-through;
  color: var(--color-muted);
}
.inline[data-type=image]:not(.focus) {
  color: var(--color-accent);
}
.inline[data-type=image]:not(.focus)::before {
  content: "🖼️ ";
}
.inline[data-type=footnoteRef]:not(.focus) {
  color: var(--color-accent);
  font-size: 0.8em;
  vertical-align: super;
}
.inline[data-type=hardBreak], .inline[data-type=softBreak] {
  display: inline;
}
.inline[data-type=rawHTML]:not(.focus) {
  font-family: monospace;
  color: var(--color-muted);
  font-size: 0.9em;
}

.blink {
  animation: blink 1s step-end infinite;
}

@keyframes blink {
  50% {
    opacity: 0;
  }
}
`

export default cssText
