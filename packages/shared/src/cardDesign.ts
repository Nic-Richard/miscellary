import type { TemplateConfig } from './api';

// Draft-only: published renderers must use their stored configuration unchanged.
export function prepareCardDesign(key: string, config: TemplateConfig): TemplateConfig {
  return {
    ...config,
    ...(key === 'minimal' ? { gradient: 'full' } : {}),
    treatment: config.treatment ?? 'none',
    coverage: config.coverage ?? 'spot',
  };
}
