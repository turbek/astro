import rss, { getRssString } from '../dist/index.js';
import { rssSchema } from '../dist/schema.js';
import chai from 'chai';
import chaiPromises from 'chai-as-promised';
import chaiXml from 'chai-xml';
import {
	title,
	description,
	site,
	phpFeedItem,
	phpFeedItemWithContent,
	phpFeedItemWithCustomData,
	web1FeedItem,
	web1FeedItemWithContent,
	web1FeedItemWithAllData,
} from './test-utils.js';

chai.use(chaiPromises);
chai.use(chaiXml);

// note: I spent 30 minutes looking for a nice node-based snapshot tool
// ...and I gave up. Enjoy big strings!
// prettier-ignore
const validXmlResult = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title><![CDATA[${title}]]></title><description><![CDATA[${description}]]></description><link>${site}/</link><item><title><![CDATA[${phpFeedItem.title}]]></title><link>${site}${phpFeedItem.link}/</link><guid isPermaLink="true">${site}${phpFeedItem.link}/</guid><description><![CDATA[${phpFeedItem.description}]]></description><pubDate>${new Date(phpFeedItem.pubDate).toUTCString()}</pubDate></item><item><title><![CDATA[${web1FeedItem.title}]]></title><link>${site}${web1FeedItem.link}/</link><guid isPermaLink="true">${site}${web1FeedItem.link}/</guid><description><![CDATA[${web1FeedItem.description}]]></description><pubDate>${new Date(web1FeedItem.pubDate).toUTCString()}</pubDate></item></channel></rss>`;
// prettier-ignore
const validXmlWithoutWeb1FeedResult = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title><![CDATA[${title}]]></title><description><![CDATA[${description}]]></description><link>${site}/</link><item><title><![CDATA[${phpFeedItem.title}]]></title><link>${site}${phpFeedItem.link}/</link><guid isPermaLink="true">${site}${phpFeedItem.link}/</guid><description><![CDATA[${phpFeedItem.description}]]></description><pubDate>${new Date(phpFeedItem.pubDate).toUTCString()}</pubDate></item></channel></rss>`;
// prettier-ignore
const validXmlWithContentResult = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><title><![CDATA[${title}]]></title><description><![CDATA[${description}]]></description><link>${site}/</link><item><title><![CDATA[${phpFeedItemWithContent.title}]]></title><link>${site}${phpFeedItemWithContent.link}/</link><guid isPermaLink="true">${site}${phpFeedItemWithContent.link}/</guid><description><![CDATA[${phpFeedItemWithContent.description}]]></description><pubDate>${new Date(phpFeedItemWithContent.pubDate).toUTCString()}</pubDate><content:encoded><![CDATA[${phpFeedItemWithContent.content}]]></content:encoded></item><item><title><![CDATA[${web1FeedItemWithContent.title}]]></title><link>${site}${web1FeedItemWithContent.link}/</link><guid isPermaLink="true">${site}${web1FeedItemWithContent.link}/</guid><description><![CDATA[${web1FeedItemWithContent.description}]]></description><pubDate>${new Date(web1FeedItemWithContent.pubDate).toUTCString()}</pubDate><content:encoded><![CDATA[${web1FeedItemWithContent.content}]]></content:encoded></item></channel></rss>`;
// prettier-ignore
const validXmlResultWithAllData = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title><![CDATA[${title}]]></title><description><![CDATA[${description}]]></description><link>${site}/</link><item><title><![CDATA[${phpFeedItem.title}]]></title><link>${site}${phpFeedItem.link}/</link><guid isPermaLink="true">${site}${phpFeedItem.link}/</guid><description><![CDATA[${phpFeedItem.description}]]></description><pubDate>${new Date(phpFeedItem.pubDate).toUTCString()}</pubDate></item><item><title><![CDATA[${web1FeedItemWithAllData.title}]]></title><link>${site}${web1FeedItemWithAllData.link}/</link><guid isPermaLink="true">${site}${web1FeedItemWithAllData.link}/</guid><description><![CDATA[${web1FeedItemWithAllData.description}]]></description><pubDate>${new Date(web1FeedItemWithAllData.pubDate).toUTCString()}</pubDate><category>${web1FeedItemWithAllData.categories[0]}</category><category>${web1FeedItemWithAllData.categories[1]}</category><author>${web1FeedItemWithAllData.author}</author><comments>${web1FeedItemWithAllData.commentsUrl}</comments><source url="${web1FeedItemWithAllData.source.url}">${web1FeedItemWithAllData.source.title}</source><enclosure url="${site}${web1FeedItemWithAllData.enclosure.url}" length="${web1FeedItemWithAllData.enclosure.length}" type="${web1FeedItemWithAllData.enclosure.type}"/></item></channel></rss>`;
// prettier-ignore
const validXmlWithCustomDataResult = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><title><![CDATA[${title}]]></title><description><![CDATA[${description}]]></description><link>${site}/</link><item><title><![CDATA[${phpFeedItemWithCustomData.title}]]></title><link>${site}${phpFeedItemWithCustomData.link}/</link><guid isPermaLink="true">${site}${phpFeedItemWithCustomData.link}/</guid><description><![CDATA[${phpFeedItemWithCustomData.description}]]></description><pubDate>${new Date(phpFeedItemWithCustomData.pubDate).toUTCString()}</pubDate>${phpFeedItemWithCustomData.customData}</item><item><title><![CDATA[${web1FeedItemWithContent.title}]]></title><link>${site}${web1FeedItemWithContent.link}/</link><guid isPermaLink="true">${site}${web1FeedItemWithContent.link}/</guid><description><![CDATA[${web1FeedItemWithContent.description}]]></description><pubDate>${new Date(web1FeedItemWithContent.pubDate).toUTCString()}</pubDate><content:encoded><![CDATA[${web1FeedItemWithContent.content}]]></content:encoded></item></channel></rss>`;
// prettier-ignore
const validXmlWithStylesheet = `<?xml version="1.0" encoding="UTF-8"?><?xml-stylesheet href="/feedstylesheet.css"?><rss version="2.0"><channel><title><![CDATA[${title}]]></title><description><![CDATA[${description}]]></description><link>${site}/</link></channel></rss>`;
// prettier-ignore
const validXmlWithXSLStylesheet = `<?xml version="1.0" encoding="UTF-8"?><?xml-stylesheet href="/feedstylesheet.xsl" type="text/xsl"?><rss version="2.0"><channel><title><![CDATA[${title}]]></title><description><![CDATA[${description}]]></description><link>${site}/</link></channel></rss>`;

describe('rss', () => {
	it('should return a response', async () => {
		const response = await rss({
			title,
			description,
			items: [phpFeedItem, web1FeedItem],
			site,
		});

		const str = await response.text();
		chai.expect(str).xml.to.equal(validXmlResult);

		const contentType = response.headers.get('Content-Type');
		chai.expect(contentType).to.equal('application/xml');
	});

	it('should be the same string as getRssString', async () => {
		const options = {
			title,
			description,
			items: [phpFeedItem, web1FeedItem],
			site,
		};

		const response = await rss(options);
		const str1 = await response.text();
		const str2 = await getRssString(options);

		chai.expect(str1).to.equal(str2);
	});
});

describe('getRssString', () => {
	it('should generate on valid RSSFeedItem array', async () => {
		const str = await getRssString({
			title,
			description,
			items: [phpFeedItem, web1FeedItem],
			site,
		});

		chai.expect(str).xml.to.equal(validXmlResult);
	});

	it('should generate on valid RSSFeedItem array with HTML content included', async () => {
		const str = await getRssString({
			title,
			description,
			items: [phpFeedItemWithContent, web1FeedItemWithContent],
			site,
		});

		chai.expect(str).xml.to.equal(validXmlWithContentResult);
	});

	it('should generate on valid RSSFeedItem array with all RSS content included', async () => {
		const str = await getRssString({
			title,
			description,
			items: [phpFeedItem, web1FeedItemWithAllData],
			site,
		});

		chai.expect(str).xml.to.equal(validXmlResultWithAllData);
	});

	it('should generate on valid RSSFeedItem array with custom data included', async () => {
		const str = await getRssString({
			xmlns: {
				dc: 'http://purl.org/dc/elements/1.1/',
			},
			title,
			description,
			items: [phpFeedItemWithCustomData, web1FeedItemWithContent],
			site,
		});

		chai.expect(str).xml.to.equal(validXmlWithCustomDataResult);
	});

	it('should include xml-stylesheet instruction when stylesheet is defined', async () => {
		const str = await getRssString({
			title,
			description,
			items: [],
			site,
			stylesheet: '/feedstylesheet.css',
		});

		chai.expect(str).xml.to.equal(validXmlWithStylesheet);
	});

	it('should include xml-stylesheet instruction with xsl type when stylesheet is set to xsl file', async () => {
		const str = await getRssString({
			title,
			description,
			items: [],
			site,
			stylesheet: '/feedstylesheet.xsl',
		});

		chai.expect(str).xml.to.equal(validXmlWithXSLStylesheet);
	});

	it('should preserve self-closing tags on `customData`', async () => {
		const customData =
			'<atom:link href="https://example.com/feed.xml" rel="self" type="application/rss+xml"/>';
		const str = await getRssString({
			title,
			description,
			items: [],
			site,
			xmlns: {
				atom: 'http://www.w3.org/2005/Atom',
			},
			customData,
		});

		chai.expect(str).to.contain(customData);
	});

	it('should filter out entries marked as `draft`', async () => {
		const str = await getRssString({
			title,
			description,
			items: [phpFeedItem, { ...web1FeedItem, draft: true }],
			site,
		});

		chai.expect(str).xml.to.equal(validXmlWithoutWeb1FeedResult);
	});

	it('should respect drafts option', async () => {
		const str = await getRssString({
			title,
			description,
			items: [phpFeedItem, { ...web1FeedItem, draft: true }],
			site,
			drafts: true,
		});

		chai.expect(str).xml.to.equal(validXmlResult);
	});

	it('should not append trailing slash to URLs with the given option', async () => {
		const str = await getRssString({
			title,
			description,
			items: [phpFeedItem, { ...web1FeedItem, draft: true }],
			site,
			drafts: true,
			trailingSlash: false,
		});

		chai.expect(str).xml.to.contain('https://example.com/<');
		chai.expect(str).xml.to.contain('https://example.com/php<');
	});

	it('Deprecated import.meta.glob mapping still works', async () => {
		const globResult = {
			'./posts/php.md': () =>
				new Promise((resolve) =>
					resolve({
						url: phpFeedItem.link,
						frontmatter: {
							title: phpFeedItem.title,
							pubDate: phpFeedItem.pubDate,
							description: phpFeedItem.description,
						},
					})
				),
			'./posts/nested/web1.md': () =>
				new Promise((resolve) =>
					resolve({
						url: web1FeedItem.link,
						frontmatter: {
							title: web1FeedItem.title,
							pubDate: web1FeedItem.pubDate,
							description: web1FeedItem.description,
						},
					})
				),
		};

		const str = await getRssString({
			title,
			description,
			items: globResult,
			site,
		});

		chai.expect(str).xml.to.equal(validXmlResult);
	});

	it('should fail when an invalid date string is provided', async () => {
		const res = rssSchema.safeParse({
			title: phpFeedItem.title,
			pubDate: 'invalid date',
			description: phpFeedItem.description,
			link: phpFeedItem.link,
		});

		chai.expect(res.success).to.be.false;
		chai.expect(res.error.issues[0].path[0]).to.equal('pubDate');
	});
});
