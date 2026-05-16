// TreeSkeleton 是侧边栏加载态，模拟原 My-Notion 文档树的紧凑行结构。
export function TreeSkeleton() {
  return (
    <div className="grid gap-2 px-3 py-1.5">
      <div className="h-3.5 w-full rounded-full bg-muted" />
      <div className="h-3.5 w-[46%] rounded-full bg-muted" />
      <div className="h-3.5 w-full rounded-full bg-muted" />
    </div>
  );
}
