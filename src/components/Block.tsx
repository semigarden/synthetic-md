import React, { useCallback } from 'react'
import styles from '../styles/Synth.module.scss'
import Inline from './Inline'
import type { Block as BlockType, Inline as InlineType } from '../hooks/createSynthEngine'

interface BlockProps {
    block: BlockType
    inlines: InlineType[]
    onInlineInput: (inline: InlineType, text: string, caretOffset: number) => void
    onInlineSplit?: (inline: InlineType, caretOffset: number) => void
    onMergeWithPrevious?: (inline: InlineType) => void
    onMergeWithNext?: (inline: InlineType) => void
}

const Block: React.FC<BlockProps> = ({ block, inlines, onInlineInput, onInlineSplit, onMergeWithPrevious, onMergeWithNext }) => {
    const renderInlines = () => (
        inlines.map((inline, index) => (
            <Inline
                key={inline.id}
                inline={inline}
                onInput={({ text, caretOffset }) => {
                    onInlineInput(inline, text, caretOffset)
                }}
                onSplit={onInlineSplit ? ({ caretOffset }) => {
                    onInlineSplit(inline, caretOffset)
                } : undefined}
                onMergeWithPrevious={onMergeWithPrevious ? () => {
                    onMergeWithPrevious(inline)
                } : undefined}
                onMergeWithNext={onMergeWithNext ? () => {
                    onMergeWithNext(inline)
                } : undefined}
                isFirstInline={index === 0}
                isLastInline={index === inlines.length - 1}
            />
        ))
    )

    const handleBlockClick = useCallback((e: React.MouseEvent) => {
        const target = e.target as HTMLElement
        if (target.hasAttribute('data-inline-id')) return

        if (inlines.length > 0) {
            const lastInline = inlines[inlines.length - 1]
            const el = document.getElementById(lastInline.id)
            if (el) {
                el.focus()

                requestAnimationFrame(() => {
                    const textNode = el.firstChild
                    if (textNode && textNode.textContent) {
                        const range = document.createRange()
                        const sel = window.getSelection()
                        range.setStart(textNode, textNode.textContent.length)
                        range.collapse(true)
                        sel?.removeAllRanges()
                        sel?.addRange(range)
                    }
                })
            }
        }
    }, [inlines])

    const commonProps = {
        'data-block-id': block.id,
        'data-block-type': block.type,
        className: styles.block,
        onClick: handleBlockClick,
    }

    switch (block.type) {
        case 'heading': {
            const level = (block as any).level as number
            const headingClass = `${styles.block} ${styles.heading} ${styles[`h${level}`]}`
            switch (level) {
                case 1:
                    return <h1 {...commonProps} className={headingClass}>{renderInlines()}</h1>
                case 2:
                    return <h2 {...commonProps} className={headingClass}>{renderInlines()}</h2>
                case 3:
                    return <h3 {...commonProps} className={headingClass}>{renderInlines()}</h3>
                case 4:
                    return <h4 {...commonProps} className={headingClass}>{renderInlines()}</h4>
                case 5:
                    return <h5 {...commonProps} className={headingClass}>{renderInlines()}</h5>
                case 6:
                default:
                    return <h6 {...commonProps} className={headingClass}>{renderInlines()}</h6>
            }
        }

        case 'blockQuote':
            return (
                <blockquote {...commonProps} className={`${styles.block} ${styles.blockquote}`}>
                    {renderInlines()}
                </blockquote>
            )

        case 'codeBlock': {
            const language = (block as any).language
            return (
                <pre {...commonProps} className={`${styles.block} ${styles.codeBlock}`}>
                    <code className={language ? `language-${language}` : undefined}>
                        {renderInlines()}
                    </code>
                </pre>
            )
        }

        case 'list': {
            const listBlock = block as any
            const ListTag = listBlock.ordered ? 'ol' : 'ul'
            return (
                <ListTag 
                    {...commonProps} 
                    className={`${styles.block} ${styles.list}`}
                    start={listBlock.ordered && listBlock.listStart !== 1 ? listBlock.listStart : undefined}
                >
                    {listBlock.children?.map((item: BlockType) => (
                        <Block 
                            key={item.id} 
                            block={item} 
                            inlines={[]} 
                            onInlineInput={onInlineInput}
                            onInlineSplit={onInlineSplit}
                            onMergeWithPrevious={onMergeWithPrevious}
                            onMergeWithNext={onMergeWithNext}
                        />
                    ))}
                </ListTag>
            )
        }

        case 'listItem':
            return (
                <li {...commonProps} className={`${styles.block} ${styles.listItem}`}>
                    {renderInlines()}
                </li>
            )

        case 'taskListItem': {
            const checked = (block as any).checked ?? false
            return (
                <li {...commonProps} className={`${styles.block} ${styles.taskListItem}`}>
                    <input 
                        type="checkbox" 
                        checked={checked} 
                        readOnly 
                        className={styles.taskCheckbox}
                    />
                    <span className={styles.taskContent}>
                        {renderInlines()}
                    </span>
                </li>
            )
        }

        case 'thematicBreak':
            return <hr {...commonProps} className={`${styles.block} ${styles.thematicBreak}`} />

        case 'table': {
            const tableBlock = block as any
            return (
                <table {...commonProps} className={`${styles.block} ${styles.table}`}>
                    <tbody>
                        {tableBlock.children?.map((row: BlockType, rowIndex: number) => (
                            <tr key={row.id} className={styles.tableRow}>
                                {(row as any).children?.map((cell: BlockType) => {
                                    const CellTag = rowIndex === 0 ? 'th' : 'td'
                                    return (
                                        <CellTag key={cell.id} className={styles.tableCell}>
                                            {cell.text}
                                        </CellTag>
                                    )
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            )
        }

        case 'htmlBlock':
            return (
                <div 
                    {...commonProps} 
                    className={`${styles.block} ${styles.htmlBlock}`}
                    dangerouslySetInnerHTML={{ __html: block.text }}
                />
            )

        case 'footnote': {
            const label = (block as any).label
            return (
                <div {...commonProps} className={`${styles.block} ${styles.footnote}`} id={`fn-${label}`}>
                    <sup className={styles.footnoteLabel}>[{label}]</sup>
                    <span className={styles.footnoteContent}>
                        {renderInlines()}
                    </span>
                </div>
            )
        }

        case 'blankLine':
            return (
                <div {...commonProps} className={`${styles.block} ${styles.blankLine}`}>
                    {renderInlines()}
                </div>
            )

        case 'paragraph':
        default:
            return (
                <p {...commonProps} className={`${styles.block} ${styles.paragraph}`}>
                    {renderInlines()}
                </p>
            )
    }
}

export default Block
