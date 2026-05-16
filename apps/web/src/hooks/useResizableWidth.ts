import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useMemoizedFn } from "ahooks";

type ResizeEdge = "left" | "right";

type UseResizableWidthOptions = {
  defaultWidth: number;
  edge: ResizeEdge;
  maxWidth: number;
  minWidth: number;
  storageKey: string;
};

function clampWidth(width: number, minWidth: number, maxWidth: number) {
  return Math.min(Math.max(width, minWidth), maxWidth);
}

function readStoredWidth(storageKey: string, defaultWidth: number, minWidth: number, maxWidth: number) {
  if (typeof window === "undefined") {
    return defaultWidth;
  }
  const storedWidth = Number(window.localStorage.getItem(storageKey));
  // 旧版本或手动改 localStorage 可能留下越界值，读取时统一夹到当前产品允许的宽度阈值内。
  return Number.isFinite(storedWidth) && storedWidth > 0 ? clampWidth(storedWidth, minWidth, maxWidth) : defaultWidth;
}

export function useResizableWidth({ defaultWidth, edge, maxWidth, minWidth, storageKey }: UseResizableWidthOptions) {
  const [width, setWidth] = useState(() => readStoredWidth(storageKey, defaultWidth, minWidth, maxWidth));
  const restoreStyleRef = useRef<{ cursor: string; userSelect: string } | null>(null);

  useEffect(() => {
    window.localStorage.setItem(storageKey, String(width));
  }, [storageKey, width]);

  const startResize = useMemoizedFn((event: ReactPointerEvent<HTMLElement>) => {
    event.preventDefault();
    // pointer capture 保证鼠标拖出细窄 handle 后仍然能收到本次拖拽的 pointer 事件。
    event.currentTarget.setPointerCapture(event.pointerId);

    const updateWidth = (pointerEvent: PointerEvent) => {
      // 左侧栏宽度取指针到视口左边的距离；右侧栏宽度取指针到视口右边的距离。
      const nextWidth = edge === "left" ? pointerEvent.clientX : window.innerWidth - pointerEvent.clientX;
      setWidth(clampWidth(nextWidth, minWidth, maxWidth));
    };
    const stopResize = () => {
      document.removeEventListener("pointermove", updateWidth);
      document.removeEventListener("pointerup", stopResize);
      if (restoreStyleRef.current) {
        document.body.style.cursor = restoreStyleRef.current.cursor;
        document.body.style.userSelect = restoreStyleRef.current.userSelect;
        restoreStyleRef.current = null;
      }
    };

    // 拖拽过程中临时禁用文本选择，避免页面正文被误选；结束时恢复调用方原本的 body 样式。
    restoreStyleRef.current = {
      cursor: document.body.style.cursor,
      userSelect: document.body.style.userSelect,
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    updateWidth(event.nativeEvent);
    document.addEventListener("pointermove", updateWidth);
    document.addEventListener("pointerup", stopResize);
  });

  return {
    startResize,
    width,
  };
}
