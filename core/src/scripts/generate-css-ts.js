import fs from 'node:fs'
import path from 'node:path'

const cssPath = path.join(process.cwd(), 'src', 'styles', 'element.css')
const outputPath = path.join(process.cwd(), 'src', 'styles', 'element-css.ts')

const cssContent = fs.readFileSync(cssPath, 'utf8')
const escapedCss = cssContent
  .replace(/\\/g, '\\\\')
  .replace(/`/g, '\\`')
  .replace(/\${/g, '\\${')

const tsContent = `// This file is auto-generated. Do not edit manually.
// Run 'npm run build:css-ts' to regenerate.

const cssText = \`${escapedCss}\`

export default cssText
`

fs.writeFileSync(outputPath, tsContent, 'utf8')
console.log(`Generated ${outputPath}`)
