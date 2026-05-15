import { create } from "zustand";

type ThemeMode = "light" | "dark";

const storageKey = "my-notion-go.theme";

// ThemeState 负责管理网页的颜色模式。将其放在 Zustand 中可以让导航栏、
// 工作区以及未来的设置弹窗都能切换相同的文档级 class。
type ThemeState = {
	mode: ThemeMode;
	init: () => void;
	toggle: () => void;
	setMode: (mode: ThemeMode) => void;
};

export const useThemeStore = create<ThemeState>((set, get) => ({
	mode: "light",

	init() {
		const stored = window.localStorage.getItem(storageKey);
		const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
		const mode: ThemeMode = stored === "dark" || stored === "light" ? stored : prefersDark ? "dark" : "light";
		applyTheme(mode);
		set({ mode });
	},

	toggle() {
		const nextMode: ThemeMode = get().mode === "dark" ? "light" : "dark";
		get().setMode(nextMode);
	},

	setMode(mode) {
		window.localStorage.setItem(storageKey, mode);
		applyTheme(mode);
		set({ mode });
	},
}));

function applyTheme(mode: ThemeMode) {
	document.documentElement.classList.toggle("dark", mode === "dark");
}
