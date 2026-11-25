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
    Request,
    Response,
    SearchRequest,
    SearchResultsProviding,
    SourceInfo,
    SourceIntents,
    SourceManga
} from '@paperback/types'

const BASE_URL = 'https://batcave.biz'

export const BatCaveInfo: SourceInfo = {
    version: '1.0.0',
    name: 'BatCave',
    icon: 'icon.png',
    author: 'Custom',
    authorWebsite: 'https://github.com/LaizyWaizy',
    description: 'BatCave comic source',
    contentRating: ContentRating.MATURE,
    websiteBaseURL: BASE_URL,
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

export class BatCave implements
    SearchResultsProviding,
    MangaProviding,
    ChapterProviding,
    HomePageSectionsProviding {

    constructor(private cheerio: CheerioAPI) {}

    requestManager = App.createRequestManager({
        requestsPerSecond: 2,
        requestTimeout: 15000,
        interceptor: {
            interceptRequest: async (
                request: Request
            ): Promise<Request> => {
                return request
            },
            interceptResponse: async (
                response: Response
            ): Promise<Response> => {
                return response
            }
        }
    })

    async getSearchResults(
        query: SearchRequest,
        metadata: any
    ): Promise<PagedResults> {
        return App.createPagedResults({
            results: [],
            metadata: undefined
        })
    }

    async getMangaDetails(
        mangaId: string
    ): Promise<SourceManga> {
        throw new Error(
            'Comic details parser not implemented.'
        )
    }

    async getChapters(
        mangaId: string
    ): Promise<Chapter[]> {
        throw new Error(
            'Chapter parser not implemented.'
        )
    }

    async getChapterDetails(
        mangaId: string,
        chapterId: string
    ): Promise<ChapterDetails> {
        throw new Error(
            'Reader parser not implemented.'
        )
    }

    async getHomePageSections(
        sectionCallback: (section: HomeSection) => void
    ): Promise<void> {
        const section = App.createHomeSection({
            id: 'popular',
            title: 'Popular Comics',
            containsMoreItems: false,
            type: HomeSectionType.singleRowNormal
        })

        section.items = []
        sectionCallback(section)
    }
}
