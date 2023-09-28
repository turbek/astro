import type { ShikiConfig } from 'astro';
import type { AstroMarkdocConfig } from '../config.js';
export default function shiki({ langs, theme, wrap, }?: ShikiConfig): Promise<AstroMarkdocConfig>;
