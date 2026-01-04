import { Document, Block } from '../ast/types'

export interface Change {
    action: 'add' | 'delete' | 'update' | 'move';
    prevBlock?: Block;
    nextBlock?: Block;
    index?: number;
  }
  
  export function diff(prevAst: Document, newAst: Document): Change[] {
    const prevBlocks = prevAst.blocks;
    const nextBlocks = newAst.blocks;
    const changes: Change[] = [];
  
    const prevById = new Map<string, Block>();
    const nextById = new Map<string, Block>();
    const nextIndexById = new Map<string, number>();
  
    prevBlocks.forEach(b => prevById.set(b.id, b));
    nextBlocks.forEach((b, i) => {
      nextById.set(b.id, b);
      nextIndexById.set(b.id, i);
    });
  
    const visited = new Set<string>();
  
    for (const prev of prevBlocks) {
      const next = nextById.get(prev.id);
  
      if (next) {
        visited.add(prev.id);
  
        const prevIdx = prevBlocks.indexOf(prev);
        const nextIdx = nextIndexById.get(prev.id)!;
  
        const contentChanged =
          prev.text !== next.text ||
          JSON.stringify(prev.inlines) !== JSON.stringify(next.inlines);
  
        if (contentChanged) {
          changes.push({
            action: 'update',
            prevBlock: prev,
            nextBlock: next,
          });
        }
  
        if (prevIdx !== nextIdx) {
          changes.push({
            action: 'move',
            prevBlock: prev,
            nextBlock: next,
            index: nextIdx,
          });
        }
      } else {
        changes.push({
          action: 'delete',
          prevBlock: prev,
        });
      }
    }
  
    for (const next of nextBlocks) {
      if (!visited.has(next.id)) {
        changes.push({
          action: 'add',
          nextBlock: next,
          index: nextBlocks.indexOf(next),
        });
      }
    }
  
    return changes;
}
