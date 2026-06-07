import { createContext, useContext } from "react";

export const ActivityContext = createContext(null);

export function useActivity() {
  const context = useContext(ActivityContext);
  if (!context) {
    throw new Error("useActivity must be used inside ActivityProvider");
  }
  return context;
}
