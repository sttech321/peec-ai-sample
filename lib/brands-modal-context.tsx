"use client";

import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

interface BrandsModalCtx {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

const BrandsModalContext = createContext<BrandsModalCtx>({
  isOpen: false,
  open: () => {},
  close: () => {},
});

export function BrandsModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <BrandsModalContext.Provider
      value={{ isOpen, open: () => setIsOpen(true), close: () => setIsOpen(false) }}
    >
      {children}
    </BrandsModalContext.Provider>
  );
}

export function useBrandsModal() {
  return useContext(BrandsModalContext);
}
