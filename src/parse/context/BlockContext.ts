// import { LineState } from "./LineState"
// import { tryOpenHeading } from "../block/heading"
// import { tryOpenCodeBlock } from "../block/codeBlock"
// import { tryOpenBlockQuote } from "../block/blockQuote"
// import { tryOpenList } from "../block/list"
// import { tryOpenThematicBreak } from "../block/thematicBreak"
// import { tryOpenHTMLBlock } from "../block/htmlBlock"
// import { tryOpenIndentedCodeBlock } from "../block/indentedCode"
// import { tryOpenSetextHeading } from "../block/heading"
// import { tryOpenLineBreak } from "../block/lineBreak"
// import { tryOpenParagraph } from "../block/paragraph"
// import type { Block, ContainerBlock } from "../../types/block"
// import type { BlockContext } from "../../types"


// function tryOpenBlock(
//     line: LineState,
//     parent: BlockContext,
//     startIndex: number,
// ): BlockContext | null {
//     return (
//         tryOpenHeading(line, parent, startIndex) ??
//         tryOpenCodeBlock(line, parent, startIndex) ??
//         tryOpenBlockQuote(line, parent, startIndex) ??

//         tryOpenList(line, parent, startIndex) ??
//         tryOpenThematicBreak(line, parent, startIndex) ??
//         tryOpenHTMLBlock(line, parent, startIndex) ??
//         tryOpenSetextHeading(line, parent) ??
//         tryOpenLineBreak(line, parent, startIndex) ??
//         tryOpenParagraph(line, parent, startIndex) ??
//         tryOpenIndentedCodeBlock(line, parent, startIndex) ??
//         null
//     )
// }

// function closeBlock(block: BlockContext, endIndex: number) {
//     block.finalize(endIndex)

//     if (block.parent && isContainerBlock(block.parent.node)) {
//         block.parent.node.children.push(block.node)
//     }
// }

// function isContainerBlock(node: Block): node is Block & ContainerBlock {
//     return "children" in node
// }

// const LEAF_BLOCK_TYPES = new Set([
//     "paragraph",
//     "heading",
//     "codeBlock",
//     "thematicBreak",
//     "htmlBlock",
//     "lineBreak",
// ])

// function isLeafBlockType(type: string): boolean {
//     return LEAF_BLOCK_TYPES.has(type)
// }

// function wouldOpenBlock(line: LineState, parent: BlockContext, startIndex: number = 0) {
//     return (
//         tryOpenHeading(line, parent, startIndex) ??
//         tryOpenCodeBlock(line, parent, startIndex) ??
//         tryOpenBlockQuote(line, parent, startIndex) ??
//         tryOpenList(line, parent, startIndex) ??
//         tryOpenThematicBreak(line, parent, startIndex) ??
//         tryOpenHTMLBlock(line, parent, startIndex) ??
//         tryOpenIndentedCodeBlock(line, parent, startIndex) ??
//         null
//     )
// }

// export { tryOpenBlock, closeBlock, isContainerBlock, isLeafBlockType, wouldOpenBlock }
