import { create } from "zustand";

type SearchCommandState = {
  open: boolean;
  openCommand: () => void;
  closeCommand: () => void;
  setOpen: (open: boolean) => void;
  toggleCommand: () => void;
};

export const useSearchCommandStore = create<SearchCommandState>((set) => ({
  open: false,
  openCommand: () => set({ open: true }),
  closeCommand: () => set({ open: false }),
  setOpen: (open) => set({ open }),
  toggleCommand: () => set((state) => ({ open: !state.open })),
}));
