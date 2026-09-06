import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

const BottomBarContext = createContext({
  height: 0,
  setHeight: (_height: number) => {
    // Standalone UI specimens do not have an app-level toast overlay.
  },
})

/** Geometry shared by the active screen's bottom bar and the app's toast overlay. */
export function BottomBarProvider({ children }: { children: ReactNode }) {
  const [height, setHeight] = useState(0)
  const value = useMemo(() => ({ height, setHeight }), [height])
  return <BottomBarContext.Provider value={value}>{children}</BottomBarContext.Provider>
}

export function useBottomBar() {
  return useContext(BottomBarContext)
}
