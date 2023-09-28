import type { AstroIntegration } from 'astro';
type TailwindOptions = {
    /**
     * Path to your tailwind config file
     * @default 'tailwind.config.js'
     */
    configFile?: string;
    /**
     * Apply Tailwind's base styles
     * Disabling this is useful when further customization of Tailwind styles
     * and directives is required. See {@link https://tailwindcss.com/docs/functions-and-directives#tailwind Tailwind's docs}
     * for more details on directives and customization.
     * @default true
     */
    applyBaseStyles?: boolean;
};
export default function tailwindIntegration(options?: TailwindOptions): AstroIntegration;
export {};
