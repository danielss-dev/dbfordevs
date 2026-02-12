import type { RedisKeyInfo } from "@/types";

export interface KeyTreeNode {
  name: string;
  fullPath: string;
  keyInfo?: RedisKeyInfo;
  children: KeyTreeNode[];
  keyCount: number;
}

export function buildKeyTree(
  keys: RedisKeyInfo[],
  delimiter: string = ":"
): KeyTreeNode[] {
  const root: KeyTreeNode[] = [];

  for (const keyInfo of keys) {
    const parts = keyInfo.key.split(delimiter);
    let currentLevel = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const fullPath = parts.slice(0, i + 1).join(delimiter);
      const isLeaf = i === parts.length - 1;

      let existing = currentLevel.find((n) => n.name === part && n.fullPath === fullPath);

      if (!existing) {
        existing = {
          name: part,
          fullPath,
          children: [],
          keyCount: 0,
        };
        currentLevel.push(existing);
      }

      if (isLeaf) {
        existing.keyInfo = keyInfo;
      }

      currentLevel = existing.children;
    }
  }

  // Compute key counts and sort recursively
  function processNode(nodes: KeyTreeNode[]): number {
    let total = 0;
    for (const node of nodes) {
      const childCount = processNode(node.children);
      node.keyCount = childCount + (node.keyInfo ? 1 : 0);
      total += node.keyCount;
    }

    // Sort: folders first (nodes with children), then leaves, alphabetical within each group
    nodes.sort((a, b) => {
      const aIsFolder = a.children.length > 0;
      const bIsFolder = b.children.length > 0;
      if (aIsFolder !== bIsFolder) return aIsFolder ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return total;
  }

  processNode(root);

  return root;
}

export function getAncestorPaths(
  key: string,
  delimiter: string = ":"
): string[] {
  const parts = key.split(delimiter);
  const paths: string[] = [];
  for (let i = 1; i < parts.length; i++) {
    paths.push(parts.slice(0, i).join(delimiter));
  }
  return paths;
}
