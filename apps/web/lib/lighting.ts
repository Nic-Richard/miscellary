'use client';

import { createContext, createElement, useContext } from 'react';
import type { ReactNode } from 'react';
export { KEY_LIGHT, slotLight } from './lightingStyle';

// Scene-lit surfaces composite material layers instead of using the flat bake.
const SceneLit = createContext(false);

export function SceneLight({ value, children }: { value: boolean; children: ReactNode }) {
  return createElement(SceneLit.Provider, { value }, children);
}

export function useSceneLit(): boolean {
  return useContext(SceneLit);
}
