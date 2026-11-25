import {
    Source,
    Manga,
    Chapter,
    ChapterDetails,
    HomeSection,
    SearchRequest,
    PagedResults,
    SourceManga,
    Request,
    Response,
    SourceInfo,
    ContentRating
} from '@paperback/types';

const GLOBALCOMIX_DOMAIN = 'https://globalcomix.com';

export const GlobalComixInfo: SourceInfo = {
    version: '1.0.0',
    name: 'GlobalComix',
    icon: 'icon.png',
    author: 'Custom',
    authorWebsite: 'https://github.com',
    description: 'Extension for reading comics on GlobalComix',
    contentRating: ContentRating.EVERYONE,
    websiteBaseURL: GLOBALCOMIX_DOMAIN,
    sourceTags: [
        {
            text: 'English',
            type: 'language'
        },
        {
            text: 'Comics',
            type: 'genre'
        }
    ]
};

export class GlobalComix implements Source {
    requestManager = createRequestManager({
        requestsPerSecond: 5,
        requestTimeout: 15000,
        interceptor: {
            interceptRequest: async (request: Request): Promise<Request> => {
                request.headers = {
                    ...(request.headers ?? {}),
                    'user-agent': await this.requestManager.getDefaultUserAgent(),
                    'referer': `${GLOBALCOMIX_DOMAIN}/`
                };
                return request;
            },
            interceptResponse: async (response: Response): Promise<Response> => {
                return response;
            }
        }
    });

    async getMangaDetails(mangaId: string): Promise<SourceManga> {
        const request = createRequestObject({
            url: `${GLOBALCOMIX_DOMAIN}/c/${mangaId}`,
            method: 'GET'
        });

        const response = await this.requestManager.schedule(request, 1);
        const $ = cheerio.load(response.data as string);

        const title = $('h1').first().text().trim();
        const image = $('.book-cover img').attr('src') ?? '';
        const description = $('.book-description').text().trim();
        
        let author = '';
        $('.book-creator a').each((_, elem) => {
            author = $(elem).text().trim();
        });

        return createSourceManga({
            id: mangaId,
            manga: createManga({
                id: mangaId,
                titles: [title],
                image: image,
                author: author,
                artist: author,
                desc: description,
                status: 'Ongoing'
            })
        });
    }

    async getChapters(mangaId: string): Promise<Chapter[]> {
        const request = createRequestObject({
            url: `${GLOBALCOMIX_DOMAIN}/c/${mangaId}`,
            method: 'GET'
        });

        const response = await this.requestManager.schedule(request, 1);
        const $ = cheerio.load(response.data as string);

        const chapters: Chapter[] = [];
        let index = 0;

        $('.chapter-row, .episode-item').each((_, elem) => {
            const title = $(elem).find('.chapter-title').text().trim() || `Chapter ${index + 1}`;
            const chapterId = $(elem).find('a').attr('href') ?? '';
            
            chapters.push(createChapter({
                id: chapterId,
                mangaId: mangaId,
                name: title,
                chapNum: index + 1,
                langCode: 'en',
                sortingIndex: index
            }));
            index++;
        });

        return chapters;
    }

    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        const request = createRequestObject({
            url: `${GLOBALCOMIX_DOMAIN}${chapterId}`,
            method: 'GET'
        });

        const response = await this.requestManager.schedule(request, 1);
        const $ = cheerio.load(response.data as string);

        const pages: string[] = [];
        $('.reader-image, .page-image img').each((_, elem) => {
            const pageUrl = $(elem).attr('data-src') || $(elem).attr('src');
            if (pageUrl) {
                pages.push(pageUrl.trim());
            }
        });

        return createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages
        });
    }

    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        const sections = [
            createHomeSection({ id: 'featured', name: 'Featured Comics', displayed: true }),
            createHomeSection({ id: 'popular', name: 'Popular Comics', displayed: true })
        ];

        for (const section of sections) {
            sectionCallback(section);
            const request = createRequestObject({
                url: `${GLOBALCOMIX_DOMAIN}/discover`,
                method: 'GET'
            });

            const response = await this.requestManager.schedule(request, 1);
            const $ = cheerio.load(response.data as string);
            const items: Manga[] = [];

            // Scrape items from discovery layout
            $('.comic-card, .book-item').each((_, elem) => {
                const title = $(elem).find('.title, h3').text().trim();
                const id = $(elem).find('a').attr('href')?.replace('/c/', '') ?? '';
                const image = $(elem).find('img').attr('src') ?? '';

                if (id && title) {
                    items.push(createManga({
                        id: id,
                        titles: [title],
                        image: image
                    }));
                }
            });

            section.items = items;
            sectionCallback(section);
        }
    }

    async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
        const searchUrl = `${GLOBALCOMIX_DOMAIN}/search?query=${encodeURIComponent(query.title ?? '')}`;
        const request = createRequestObject({
            url: searchUrl,
            method: 'GET'
        });

        const response = await this.requestManager.schedule(request, 1);
        const $ = cheerio.load(response.data as string);
        const results: Manga[] = [];

        $('.search-result-item, .comic-card').each((_, elem) => {
            const title = $(elem).find('.title').text().trim();
            const id = $(elem).find('a').attr('href')?.replace('/c/', '') ?? '';
            const image = $(elem).find('img').attr('src') ?? '';

            if (id && title) {
                results.push(createManga({
                    id: id,
                    titles: [title],
                    image: image
                }));
            }
        });

        return createPagedResults({
            results: results,
            metadata: undefined
        });
    }
}
