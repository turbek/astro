import type {
	AstroAdapter,
	AstroConfig,
	AstroIntegration,
	AstroIntegrationLogger,
	RouteData,
} from 'astro';
import { AstroError } from 'astro/errors';
import glob from 'fast-glob';
import { basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
	getAstroImageConfig,
	getDefaultImageConfig,
	type DevImageService,
	type VercelImageConfig,
} from '../image/shared.js';
import { getVercelOutput, removeDir, writeJson } from '../lib/fs.js';
import { copyDependenciesToFunction } from '../lib/nft.js';
import { getRedirects } from '../lib/redirects.js';
import {
	getSpeedInsightsViteConfig,
	type VercelSpeedInsightsConfig,
} from '../lib/speed-insights.js';
import {
	getInjectableWebAnalyticsContent,
	type VercelWebAnalyticsConfig,
} from '../lib/web-analytics.js';
import { generateEdgeMiddleware } from './middleware.js';

const PACKAGE_NAME = '@astrojs/vercel/serverless';
export const ASTRO_LOCALS_HEADER = 'x-astro-locals';
export const VERCEL_EDGE_MIDDLEWARE_FILE = 'vercel-edge-middleware';

// https://vercel.com/docs/concepts/functions/serverless-functions/runtimes/node-js#node.js-version
const SUPPORTED_NODE_VERSIONS: Record<
	string,
	{ status: 'current' } | { status: 'deprecated'; removal: Date }
> = {
	14: { status: 'deprecated', removal: new Date('August 15 2023') },
	16: { status: 'deprecated', removal: new Date('February 6 2024') },
	18: { status: 'current' },
};

function getAdapter({
	edgeMiddleware,
	functionPerRoute,
}: {
	edgeMiddleware: boolean;
	functionPerRoute: boolean;
}): AstroAdapter {
	return {
		name: PACKAGE_NAME,
		serverEntrypoint: `${PACKAGE_NAME}/entrypoint`,
		exports: ['default'],
		adapterFeatures: {
			edgeMiddleware,
			functionPerRoute,
		},
		supportedAstroFeatures: {
			hybridOutput: 'stable',
			staticOutput: 'stable',
			serverOutput: 'stable',
			assets: {
				supportKind: 'stable',
				isSharpCompatible: true,
				isSquooshCompatible: true,
			},
		},
	};
}

export interface VercelServerlessConfig {
	/**
	 * @deprecated
	 */
	analytics?: boolean;
	webAnalytics?: VercelWebAnalyticsConfig;
	speedInsights?: VercelSpeedInsightsConfig;
	includeFiles?: string[];
	excludeFiles?: string[];
	imageService?: boolean;
	imagesConfig?: VercelImageConfig;
	devImageService?: DevImageService;
	edgeMiddleware?: boolean;
	functionPerRoute?: boolean;
}

export default function vercelServerless({
	analytics,
	webAnalytics,
	speedInsights,
	includeFiles,
	excludeFiles,
	imageService,
	imagesConfig,
	devImageService = 'sharp',
	functionPerRoute = false,
	edgeMiddleware = false,
}: VercelServerlessConfig = {}): AstroIntegration {
	let _config: AstroConfig;
	let buildTempFolder: URL;
	let serverEntry: string;
	let _entryPoints: Map<RouteData, URL>;
	// Extra files to be merged with `includeFiles` during build
	const extraFilesToInclude: URL[] = [];

	const NTF_CACHE = Object.create(null);

	async function createFunctionFolder(
		funcName: string,
		entry: URL,
		inc: URL[],
		logger: AstroIntegrationLogger
	) {
		const functionFolder = new URL(`./functions/${funcName}.func/`, _config.outDir);

		// Copy necessary files (e.g. node_modules/)
		const { handler } = await copyDependenciesToFunction(
			{
				entry,
				outDir: functionFolder,
				includeFiles: inc,
				excludeFiles: excludeFiles?.map((file) => new URL(file, _config.root)) || [],
				logger,
			},
			NTF_CACHE
		);

		// Enable ESM
		// https://aws.amazon.com/blogs/compute/using-node-js-es-modules-and-top-level-await-in-aws-lambda/
		await writeJson(new URL(`./package.json`, functionFolder), {
			type: 'module',
		});

		// Serverless function config
		// https://vercel.com/docs/build-output-api/v3#vercel-primitives/serverless-functions/configuration
		await writeJson(new URL(`./.vc-config.json`, functionFolder), {
			runtime: getRuntime(),
			handler,
			launcherType: 'Nodejs',
		});
	}

	return {
		name: PACKAGE_NAME,
		hooks: {
			'astro:config:setup': async ({ command, config, updateConfig, injectScript, logger }) => {
				if (webAnalytics?.enabled || analytics) {
					if (analytics) {
						logger.warn(
							`The \`analytics\` property is deprecated. Please use the new \`webAnalytics\` and \`speedInsights\` properties instead.`
						);
					}

					injectScript(
						'head-inline',
						await getInjectableWebAnalyticsContent({
							mode: command === 'dev' ? 'development' : 'production',
						})
					);
				}
				if (command === 'build' && (speedInsights?.enabled || analytics)) {
					injectScript('page', 'import "@astrojs/vercel/speed-insights"');
				}
				const outDir = getVercelOutput(config.root);
				updateConfig({
					outDir,
					build: {
						serverEntry: 'entry.mjs',
						client: new URL('./static/', outDir),
						server: new URL('./dist/', config.root),
					},
					vite: {
						...getSpeedInsightsViteConfig(speedInsights?.enabled || analytics),
						ssr: {
							external: ['@vercel/nft'],
						},
					},
					...getAstroImageConfig(
						imageService,
						imagesConfig,
						command,
						devImageService,
						config.image
					),
				});
			},
			'astro:config:done': ({ setAdapter, config, logger }) => {
				if (functionPerRoute === true) {
					logger.warn(
						`Vercel's hosting plans might have limits to the number of functions you can create.
Make sure to check your plan carefully to avoid incurring additional costs.
You can set functionPerRoute: false to prevent surpassing the limit.`
					);
				}
				setAdapter(getAdapter({ functionPerRoute, edgeMiddleware }));
				_config = config;
				buildTempFolder = config.build.server;
				serverEntry = config.build.serverEntry;

				if (config.output === 'static') {
					throw new AstroError(
						'`output: "server"` or `output: "hybrid"` is required to use the serverless adapter.'
					);
				}
			},

			'astro:build:ssr': async ({ entryPoints, middlewareEntryPoint }) => {
				_entryPoints = entryPoints;
				if (middlewareEntryPoint) {
					const outPath = fileURLToPath(buildTempFolder);
					const vercelEdgeMiddlewareHandlerPath = new URL(
						VERCEL_EDGE_MIDDLEWARE_FILE,
						_config.srcDir
					);
					const bundledMiddlewarePath = await generateEdgeMiddleware(
						middlewareEntryPoint,
						outPath,
						vercelEdgeMiddlewareHandlerPath
					);
					// let's tell the adapter that we need to save this file
					extraFilesToInclude.push(bundledMiddlewarePath);
				}
			},

			'astro:build:done': async ({ routes, logger }) => {
				// Merge any includes from `vite.assetsInclude
				if (_config.vite.assetsInclude) {
					const mergeGlobbedIncludes = (globPattern: unknown) => {
						if (typeof globPattern === 'string') {
							const entries = glob.sync(globPattern).map((p) => pathToFileURL(p));
							extraFilesToInclude.push(...entries);
						} else if (Array.isArray(globPattern)) {
							for (const pattern of globPattern) {
								mergeGlobbedIncludes(pattern);
							}
						}
					};

					mergeGlobbedIncludes(_config.vite.assetsInclude);
				}

				const routeDefinitions: { src: string; dest: string }[] = [];
				const filesToInclude = includeFiles?.map((file) => new URL(file, _config.root)) || [];
				filesToInclude.push(...extraFilesToInclude);

				validateRuntime();

				// Multiple entrypoint support
				if (_entryPoints.size) {
					const getRouteFuncName = (route: RouteData) => route.component.replace('src/pages/', '');

					const getFallbackFuncName = (entryFile: URL) =>
						basename(entryFile.toString())
							.replace('entry.', '')
							.replace(/\.mjs$/, '');

					for (const [route, entryFile] of _entryPoints) {
						const func = route.component.startsWith('src/pages/')
							? getRouteFuncName(route)
							: getFallbackFuncName(entryFile);

						await createFunctionFolder(func, entryFile, filesToInclude, logger);
						routeDefinitions.push({
							src: route.pattern.source,
							dest: func,
						});
					}
				} else {
					await createFunctionFolder(
						'render',
						new URL(serverEntry, buildTempFolder),
						filesToInclude,
						logger
					);
					routeDefinitions.push({ src: '/.*', dest: 'render' });
				}

				// Output configuration
				// https://vercel.com/docs/build-output-api/v3#build-output-configuration
				await writeJson(new URL(`./config.json`, _config.outDir), {
					version: 3,
					routes: [
						...getRedirects(routes, _config),
						{
							src: `^/${_config.build.assets}/(.*)$`,
							headers: { 'cache-control': 'public, max-age=31536000, immutable' },
							continue: true,
						},
						{ handle: 'filesystem' },
						...routeDefinitions,
					],
					...(imageService || imagesConfig
						? {
								images: imagesConfig
									? {
											...imagesConfig,
											domains: [...imagesConfig.domains, ..._config.image.domains],
											remotePatterns: [
												...(imagesConfig.remotePatterns ?? []),
												..._config.image.remotePatterns,
											],
									  }
									: getDefaultImageConfig(_config.image),
						  }
						: {}),
				});

				// Remove temporary folder
				await removeDir(buildTempFolder);
			},
		},
	};
}

function validateRuntime() {
	const version = process.version.slice(1); // 'v16.5.0' --> '16.5.0'
	const major = version.split('.')[0]; // '16.5.0' --> '16'
	const support = SUPPORTED_NODE_VERSIONS[major];
	if (support === undefined) {
		console.warn(
			`[${PACKAGE_NAME}] The local Node.js version (${major}) is not supported by Vercel Serverless Functions.`
		);
		console.warn(`[${PACKAGE_NAME}] Your project will use Node.js 18 as the runtime instead.`);
		console.warn(`[${PACKAGE_NAME}] Consider switching your local version to 18.`);
		return;
	}
	if (support.status === 'deprecated') {
		console.warn(
			`[${PACKAGE_NAME}] Your project is being built for Node.js ${major} as the runtime.`
		);
		console.warn(
			`[${PACKAGE_NAME}] This version is deprecated by Vercel Serverless Functions, and scheduled to be disabled on ${new Intl.DateTimeFormat(
				undefined,
				{ dateStyle: 'long' }
			).format(support.removal)}.`
		);
		console.warn(`[${PACKAGE_NAME}] Consider upgrading your local version to 18.`);
	}
}

function getRuntime() {
	const version = process.version.slice(1); // 'v16.5.0' --> '16.5.0'
	const major = version.split('.')[0]; // '16.5.0' --> '16'
	const support = SUPPORTED_NODE_VERSIONS[major];
	if (support === undefined) {
		return 'nodejs18.x';
	}
	return `nodejs${major}.x`;
}
