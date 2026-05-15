// TreeSkeleton 是侧边栏加载态，模拟原 My-Notion 文档树的紧凑行结构。
export function TreeSkeleton() {
  return (
    <div className="tree-skeleton">
      <div className="skeleton-line" />
      <div className="skeleton-line short" />
      <div className="skeleton-line" />
    </div>
  );
}
