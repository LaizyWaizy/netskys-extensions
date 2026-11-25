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
    version: '1.0.0',
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
    intents: SourceIntents.MANGA_CHAPTERS | SourceIntents.HOMEPAGE_SECTIONS
}

export class GlobalComix implements SearchResultsProviding, MangaProviding, ChapterProviding, HomePageSectionsProviding {
    constructor(private cheerio: CheerioAPI) {}

    requestManager = App.createRequestManager({
        requestsPerSecond: 4,
        requestTimeout: 15000,
        interceptor: {
            interceptRequest: async (request: Request): Promise<Request> => {
                request.headers = {
                    ...(request.headers ?? {}),
                    'referer': `${GC_DOMAIN}/`,
                    'user-agent': await this.requestManager.getDefaultUserAgent()
                }
                return request
            },
            interceptResponse: async (response: Response): Promise<Response> => {
                return response
            }
        }
    })

    getMangaShareUrl(mangaId: string): string {
        return `${GC_DOMAIN}/c/${mangaId}`
    }

    async getMangaDetails(mangaId: string): Promise<SourceManga> {
        const request = App.createRequest({
            url: `${GC_DOMAIN}/c/${mangaId}`,
            method: 'GET'
        })
        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data as string)

        const title = $('h1').first().text().trim() || mangaId
        const image = $('meta[property="og:image"]').attr('content') ?? ''
        const desc = $('meta[property="og:description"]').attr('content')?.trim() ?? ''
        const author = $('a[href*="/a/"]').first().text().trim() || 'Unknown'

        const tags: Tag[] = []
        $('a[href*="/genres/"], a[href*="/tags/"]').each((_, el) => {
            const label = $(el).text().trim()
            const href = $(el).attr('href') ?? ''
            const id = href.split('/').filter(Boolean).pop() ?? label.toLowerCase()
            if (label && !tags.some((t) => t.id === id)) {
                tags.push(App.createTag({ id, label }))
            }
        })

        const tagSections: TagSection[] = tags.length > 0
            ? [App.createTagSection({ id: '0', label: 'Genres', tags })]
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

    async getChapters(mangaId: string): Promise<Chapter[]> {
        const request = App.createRequest({
            url: `${GC_DOMAIN}/c/${mangaId}`,
            method: 'GET'
        })
        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data as string)

        const chapters: Chapter[] = []
        const seen = new Set<string>()

        $(`a[href*="/c/${mangaId}/chapters/"]`).each((index, el) => {
            const href = $(el).attr('href') ?? ''
            const match = href.match(/\/chapters\/([^/?#]+)/)
            if (!match) return

            const chapterId = match[1]
            if (seen.has(chapterId)) return
            seen.add(chapterId)

            const rawName = $(el).text().trim() || `Chapter ${index + 1}`
            const numMatch = rawName.match(/(\d+(?:\.\d+)?)/)
            const chapNum = numMatch ? parseFloat(numMatch[1]) : index + 1

            chapters.push(
                App.createChapter({
                    id: chapterId,
                    name: rawName,
                    chapNum,
                    langCode: '🇬🇧'
                })
            )
        })

        return chapters
    }

    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        const request = App.createRequest({
            url: `${GC_DOMAIN}/c/${mangaId}/chapters/${chapterId}`,
            method: 'GET'
        })
        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data as string)

        const pages: string[] = []
        $('img').each((_, el) => {
            const src = $(el).attr('data-src') || $(el).attr('src') || ''
            if (src && (src.includes('/pages/') || src.includes('cdn.globalcomix.com')) && !pages.includes(src)) {
                pages.push(src.startsWith('http') ? src : `https:${src}`)
            }
        })

        return App.createChapterDetails({
            id: chapterId,
            mangaId,
            pages
        })
    }

    async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
        const page: number = metadata?.page ?? 1
        const searchTerm = encodeURIComponent(query.title ?? '')
        const url = searchTerm
            ? `${GC_DOMAIN}/search?q=${searchTerm}&page=${page}`
            : `${GC_DOMAIN}/browse?page=${page}`

        const request = App.createRequest({
            url,
            method: 'GET'
        })
        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data as string)

        const tiles: PartialSourceManga[] = []
        const seen = new Set<string>()

        $('a[href*="/c/"]').each((_, el) => {
            const href = $(el).attr('href') ?? ''
            const match = href.match(/\/c\/([^/?#]+)$/)
            if (!match) return

            const id = match[1]
            if (seen.has(id)) return
            seen.add(id)

            const img = $(el).find('img').first()
            const title = img.attr('alt')?.trim() || $(el).text().trim() || id
            const image = img.attr('data-src') || img.attr('src') || ''

            if (title) {
                tiles.push(
                    App.createPartialSourceManga({
                        mangaId: id,
                        title,
                        image: image.startsWith('http') || !image ? image : `${GC_DOMAIN}${image}`
                    })
                )
            }
        })

        return App.createPagedResults({
            results: tiles,
            metadata: tiles.length > 0 ? { page: page + 1 } : undefined
        })
    }

    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        const popularSection = App.createHomeSection({
            id: 'popular',
            title: 'Popular Comics',
            containsMoreItems: true,
            type: HomeSectionType.singleRowNormal
        })
        sectionCallback(popularSection)

        const results = await this.getSearchResults({ title: '' }, { page: 1 })
        popularSection.items = results.results
        sectionCallback(popularSection)
    }
}
