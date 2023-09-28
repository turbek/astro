import { loadFixture } from './test-utils.js';
import { expect } from 'chai';

describe('build: split', () => {
	/** @type {import('./test-utils').Fixture} */
	let fixture;

	before(async () => {
		fixture = await loadFixture({
			root: './fixtures/functionPerRoute/',
			output: 'server',
		});
		await fixture.build();
	});

	it('creates separate functions for each page', async () => {
		const files = await fixture.readdir('../.vercel/output/functions/');
		expect(files.length).to.equal(3);
	});

	it('creates the route definitions in the config.json', async () => {
		const json = await fixture.readFile('../.vercel/output/config.json');
		const config = JSON.parse(json);
		expect(config.routes).to.have.a.lengthOf(5);
	});
});
