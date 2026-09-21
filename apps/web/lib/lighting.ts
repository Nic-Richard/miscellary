'use client';

import { createContext, useContext } from 'react';
export { KEY_LIGHT, slotLight } from './lightingStyle';

// Scene-lit surfaces composite material layers instead of using the flat bake.
const SceneLit = createContext(false);

export const SceneLight = SceneLit.Provider;

export function useSceneLit(): boolean {
  return useContext(SceneLit);
}
