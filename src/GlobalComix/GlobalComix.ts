
import {
    BadgeColor,
    Chapter,
    ChapterDetails,
    ChapterProviding,
    ContentRating,
    HomePageSectionsProviding,
    HomeSection,
    HomeSectionType,
    MangaProviding,
    PagedResults,
    PartialSourceManga,
    Request,
    Response,
    SearchRequest,
    SearchResultsProviding,
    SourceInfo,
    SourceIntents,
    SourceManga,
    Tag,
    TagSection
} from '@paperback/types'

const GC_DOMAIN = 'https://globalcomix.com'

export const GlobalComixInfo: SourceInfo = {
    version: '1.0.1',
    name: 'GlobalComix',
    icon: 'icon.png',
    author: 'Custom',
    authorWebsite: 'https://github.com/LaizyWaizy',
    description: 'Extension that pulls comics from globalcomix.com',
    contentRating: ContentRating.EVERYONE,
    websiteBaseURL: GC_DOMAIN,
    sourceTags: [
        {
            text: 'English',
            type: BadgeColor.BLUE
        }
    ],
    intents:
        SourceIntents.MANGA_CHAPTERS |
        SourceIntents.HOMEPAGE_SECTIONS
}

export class GlobalComix implements
    SearchResultsProviding,
    MangaProviding,
    ChapterProviding,
    HomePageSectionsProviding {

    constructor(private cheerio: CheerioAPI) {}

    requestManager = App.createRequestManager({
        requestsPerSecond: 4,
        requestTimeout: 15000,
        interceptor: {
            interceptRequest: async (
                request: Request
            ): Promise<Request> => {
                request.headers = {
                    ...(request.headers ?? {}),
                    'referer': `${GC_DOMAIN}/`,
                    'user-agent':
                        await this.requestManager.getDefaultUserAgent()
                }
                return request
            },
            interceptResponse: async (
                response: Response
            ): Promise<Response> => {
                return response
            }
        }
    })

    private decodeText(value: string): string {
        return this.cheerio
            .load('<div></div>')('div')
            .html(value)
            .text()
            .trim()
    }

    private normalizeImage(
        image: string,
        basePath: string = '/'
    ): string {
        if (!image) return ''

        if (/^https?:\/\//i.test(image)) {
            return image
        }

        if (image.startsWith('//')) {
            return `https:${image}`
        }

        if (image.startsWith('/')) {
            return `${GC_DOMAIN}${image}`
        }

        if (/^[a-z][a-z0-9+.-]*:/i.test(image)) {
            return ''
        }

        const segments = basePath.split('/')
        segments.pop()

        for (const part of image.split('/')) {
            if (part === '..') {
                segments.pop()
            } else if (part !== '.') {
                segments.push(part)
            }
        }

        return `${GC_DOMAIN}/${segments.filter(Boolean).join('/')}`
    }

    getMangaShareUrl(mangaId: string): string {
        return `${GC_DOMAIN}/c/${mangaId}`
    }

    async getMangaDetails(
        mangaId: string
    ): Promise<SourceManga> {

        const request = App.createRequest({
            url: `${GC_DOMAIN}/c/${mangaId}`,
            method: 'GET'
        })

        const response =
            await this.requestManager.schedule(request, 1)

        const $ = this.cheerio.load(
            response.data as string
        )

        const title =
            $('h1').first().text().trim() || mangaId

        const image = this.normalizeImage(
            $('meta[property="og:image"]')
                .attr('content') ?? '',
            `/c/${mangaId}`
        )

        const desc = this.decodeText(
            $('meta[property="og:description"]')
                .attr('content') ?? ''
        )

        const author =
            $('a[href*="/a/"]')
                .first()
                .text()
                .trim() || 'Unknown'

        const tags: Tag[] = []

        $('a[href*="/genres/"], a[href*="/tags/"]')
            .each((_, el) => {

                const label = $(el).text().trim()
                const href = $(el).attr('href') ?? ''

                const id =
                    href.split('/')
                        .filter(Boolean)
                        .pop() ?? label.toLowerCase()

                if (
                    label &&
                    !tags.some((t) => t.id === id)
                ) {
                    tags.push(
                        App.createTag({
                            id,
                            label
                        })
                    )
                }
            })

        const tagSections: TagSection[] =
            tags.length > 0
                ? [
                    App.createTagSection({
                        id: '0',
                        label: 'Genres',
                        tags
                    })
                ]
                : []

        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [title],
                image,
                status: 'Ongoing',
                author,
                artist: author,
                desc,
                tags: tagSections
            })
        })
    }

    async getChapters(
        mangaId: string
    ): Promise<Chapter[]> {

        const request = App.createRequest({
            url: `${GC_DOMAIN}/c/${mangaId}`,
            method: 'GET'
        })

        const response =
            await this.requestManager.schedule(request, 1)

        const $ = this.cheerio.load(
            response.data as string
        )

        const chapters: Chapter[] = []
        const seen = new Set<string>()

        $('a[href]').each((_, el) => {

            const href = $(el).attr('href') ?? ''

            const path = href
                .replace(
                    /^(?:https?:)?\/\/globalcomix\.com/i,
                    ''
                )
                .split(/[?#]/)[0]

            const prefix = `/c/${mangaId}/`

            if (!path.startsWith(prefix)) return

            const release = path.slice(prefix.length)

            const legacy = release.match(
                /^chapters\/([a-z-]+)\/(\d+)(?:\/|$)/i
            )

            const modern = release.match(
                /^r\/([a-f0-9-]{36})(?:\/|$)/i
            )

            if (!legacy && !modern) return

            const chapterId = legacy
                ? `chapters/${legacy[1]}/${legacy[2]}`
                : `r/${modern![1]}`

            if (seen.has(chapterId)) return

            const rawName = this.decodeText(
                $(el).attr('title')?.trim() ||
                $(el).find('img')
                    .first()
                    .attr('alt')?.trim() ||
                $(el).text().trim() ||
                `Release ${chapters.length + 1}`
            )

            const numMatch = rawName.match(
                /(?:#|Issue\s+|Chapter\s+|Volume\s+)(\d+(?:\.\d+)?)/i
            )

            const chapNum = numMatch
                ? parseFloat(numMatch[1])
                : legacy
                    ? parseInt(legacy[2], 10)
                    : chapters.length + 1

            seen.add(chapterId)

            chapters.push(
                App.createChapter({
                    id: chapterId,
                    name: rawName,
                    chapNum,
                    langCode: '🇬🇧'
                })
            )
        })

        return chapters.sort(
            (a, b) => b.chapNum - a.chapNum
        )
    }

    async getChapterDetails(
        mangaId: string,
        chapterId: string
    ): Promise<ChapterDetails> {

        const validChapterId =
            /^(?:chapters\/[a-z-]+\/\d+|r\/[a-f0-9-]{36})$/i

        if (!validChapterId.test(chapterId)) {
            throw new Error(
                'Invalid GlobalComix release ID'
            )
        }

        const chapterPath =
            `/c/${mangaId}/${chapterId}`

        const request = App.createRequest({
            url: `${GC_DOMAIN}${chapterPath}`,
            method: 'GET'
        })

        const response =
            await this.requestManager.schedule(request, 1)

        const $ = this.cheerio.load(
            response.data as string
        )

        const pages: string[] = []
        const seen = new Set<string>()

        // Only inspect page images explicitly exposed
        // by the accessible release response.
        // Do not bypass authentication or paid access.

        $('img').each((_, el) => {

            const src =
                $(el).attr('data-src') ||
                $(el).attr('src') ||
                ''

            if (!src || !src.includes('/pages/')) {
                return
            }

            const image = this.normalizeImage(
                src,
                chapterPath
            )

            if (!image || seen.has(image)) return

            seen.add(image)
            pages.push(image)
        })

        if (pages.length === 0) {
            throw new Error(
                'No accessible comic pages found. ' +
                'This release may require an account, ' +
                'a subscription, or an updated reader parser.'
            )
        }

        return App.createChapterDetails({
            id: chapterId,
            mangaId,
            pages
        })
    }

    async getSearchResults(
        query: SearchRequest,
        metadata: any
    ): Promise<PagedResults> {

        const page: number = metadata?.page ?? 1

        const searchTerm =
            encodeURIComponent(query.title ?? '')

        const url = searchTerm
            ? `${GC_DOMAIN}/search?q=${searchTerm}&page=${page}`
            : `${GC_DOMAIN}/browse?page=${page}`

        const request = App.createRequest({
            url,
            method: 'GET'
        })

        const response =
            await this.requestManager.schedule(request, 1)

        const $ = this.cheerio.load(
            response.data as string
        )

        const tiles: PartialSourceManga[] = []
        const seen = new Set<string>()

        $('a[href*="/c/"]').each((_, el) => {

            const href = $(el).attr('href') ?? ''

            const match = href.match(
                /\/c\/([^/?#]+)$/
            )

            if (!match) return

            const id = match[1]

            if (seen.has(id)) return

            seen.add(id)

            const img = $(el).find('img').first()

            const title = this.decodeText(
                img.attr('alt')?.trim() ||
                $(el).text().trim() ||
                id
            )

            const image = this.normalizeImage(
                img.attr('data-src') ||
                img.attr('src') ||
                ''
            )

            if (title) {
                tiles.push(
                    App.createPartialSourceManga({
                        mangaId: id,
                        title,
                        image
                    })
                )
            }
        })

        return App.createPagedResults({
            results: tiles,
            metadata: tiles.length > 0
                ? { page: page + 1 }
                : undefined
        })
    }

    async getHomePageSections(
        sectionCallback: (section: HomeSection) => void
    ): Promise<void> {

        const popularSection = App.createHomeSection({
            id: 'popular',
            title: 'Popular Comics',
            containsMoreItems: true,
            type: HomeSectionType.singleRowNormal
        })

        sectionCallback(popularSection)

        const results = await this.getSearchResults(
            { title: '' },
            { page: 1 }
        )

        popularSection.items = results.results

        sectionCallback(popularSection)
    }

    async getViewMoreItems(
        homepageSectionId: string,
        metadata: any
    ): Promise<PagedResults> {

        if (homepageSectionId !== 'popular') {
            return App.createPagedResults({
                results: []
            })
        }

        return this.getSearchResults(
            { title: '' },
            { page: metadata?.page ?? 1 }
        )
    }
}
