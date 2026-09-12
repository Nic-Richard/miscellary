import type { TemplateConfig } from './api';

// Draft-only: published renderers must use their stored configuration unchanged.
export function prepareCardDesign(_key: string, config: TemplateConfig): TemplateConfig {
  return {
    ...config,
    treatment: config.treatment ?? 'none',
    coverage: config.coverage ?? 'spot',
  };
}
