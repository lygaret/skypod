import { RxCollection, RxDatabase, RxDocument } from "rxdb";
import { add } from 'date-fns'

// only for types, we should figure another way to do this
import nodeFetch from 'node-fetch'
type FetchFunction = typeof nodeFetch.default

import { convertDate, hashId } from "../index.js";
import { channelSchema as upstreamChannelSchema } from '../public-api.js'
import { RxCollectionRegistration } from "./index.js";

export type Channel = {
    id: string;

    feedUrl: string;
    htmlUrl?: string | null;
    imageUrl?: string | null;
    imageLabel?: string | null;

    title?: string;
    description?: string | null;
    language?: string | null;
    copyright?: string | null;
    tags?: string[] | null;
    people?: Record<string, string> | null;
    generator?: string | null;

    // from upstream
    lastBuildAt?: number | null;
    lastFetchAt?: number | null;
    nextFetchAt?: number | null;

    // for local only
    refreshHP: number;
    nextRefreshAt?: number | null;
    lastRefreshAt?: number;
    lastRefreshStatus?: string;
    lastRefreshHttpStatus?: number;
    lastRefreshHttpEtag?: string | null;
};

export interface ChannelMethods {
  refresh(): Promise<void>
}

export interface ChannelStatics {
  fetchAndUpsert(url: string): Promise<{ channel: Channel, entries: ChannelEntry[] }>;
}

export type ChannelCollection = RxCollection<Channel, ChannelMethods, ChannelStatics>
export type ChannelDocument   = RxDocument<Channel, ChannelMethods>

export type ChannelEntry = {
    id: string;
    channelId: string;

    guid: string;
    title: string | null;
    linkUrl: string | null;
    imageUrl: string | null;
    imageLabel: string | null;

    snippet: string | null;
    content: string | null;
    enclosure: {
        url: string;
        type?: string;
        length?: number;
    } | null;
    tags: string[] | null;
    people: Record<string, string> | null;

    podcast: {
        explicit?: boolean;
        duration?: string;
        seasonNum?: number;
        episodeNum?: number;
        fundingUrl?: string;
        fundingLabel?: string;
        transcriptUrl?: string;
    } | null;
    
    fetchedAt: number | null;
    publishedAt: number | null;
}

export type ChannelEntryDocument = RxDocument<ChannelEntry>;
export type ChannelEntryCollection = RxCollection<ChannelEntry>;

type RegistrationProps = {
  httpFetch: FetchFunction,
  httpRewrite: (url: string) => string
}

export const channelCollectionName = 'channels' as const;
export function getChannelCollection(database: RxDatabase): ChannelCollection {
  return database.collections[channelCollectionName] as ChannelCollection;
}

export const channelEntriesName = 'channel-entries' as const;
export function getChannelEntryCollection(database: RxDatabase): ChannelEntryCollection {
  return database.collections[channelEntriesName] as ChannelEntryCollection;
}

export const channelEntriesRegistration: RxCollectionRegistration<ChannelEntry> = {
    name: channelEntriesName,
    schema: {
        description: "An RSS channel entry, like an article or podcast episode",
        version: 0,
        type: "object",
        primaryKey: "id",
        properties: {
            id:            { type: "string", maxLength: 255 },
            channelId:     { type: "string", maxLength: 255 },

            guid:          { type: "string" },
            linkUrl:       { type: ["string", "null"] },
            imageUrl:      { type: ["string", "null"] },
            imageLabel:    { type: ["string", "null"] },
            
            publishedAt:   { type: ["integer", "null"] },
            fetchedAt:     { type: ["integer", "null"] },

            title:         { type: ["string", "null"] },
            content:       { type: ["string", "null"] },
            snippet:       { type: ["string", "null"] },
            
            tags:          { 
                type: ["array", "null"],
                items: { type: "string" }
            },
            people:        {
                type: ["object", "null"],
                additionalProperties: { type: "string" }
            },
            
            enclosure:     {
                type: ["object", "null"],
                properties: {
                    url:    { type: "string" },
                    length: { type: ["integer", "null"] },
                    type:   { type: ["string", "null"] }
                },
                required: ["url"],
                additionalProperties: false
            },
            
            podcast:       {
                type: ["object", "null"],
                properties: {
                    explicit:      { type: "boolean" },
                    duration:      { type: "string" },
                    seasonNum:     { type: "integer" },
                    episodeNum:    { type: "integer" },
                    fundingUrl:    { type: "string" },
                    fundingLabel:  { type: "string" },
                    transcriptUrl: { type: "string" }
                },
                additionalProperties: false
            }
        },
        required: ["id", "channelId", "guid", "title", "publishedAt"],
        additionalProperties: false,
        indexes: ["channelId"],
    },
    autoMigrate: true,
    migrationStrategies: {}
}

export const channelsRegistration = (props: RegistrationProps): RxCollectionRegistration<Channel> => ({
    name: channelCollectionName,
    schema: {
        version: 0,
        type: "object",
        primaryKey: "id",
        properties: {
            id:  { type: "string", maxLength: 255 },

            feedUrl:       { type: "string" },
            htmlUrl:       { type: ["string", "null"] },
            imageUrl:      { type: ["string", "null"] },
            imageLabel:    { type: ["string", "null"] },
            
            title:         { type: ["string"] },
            description:   { type: ["string", "null"] },
            language:      { type: ["string", "null"] },
            copyright:     { type: ["string", "null"] },
            generator:     { type: ["string", "null"] },

            tags:          { 
                type: ["array", "null"],
                items: { type: "string" }
            },
            people:        {
                type: ["object", "null"],
                additionalProperties: { type: "string" }
            },

            lastBuildAt:   { type: ["integer", "null"] },
            lastFetchAt:   { type: ["integer", "null"] },
            nextFetchAt:   { type: ["integer", "null"] },

            refreshHP:             { type: "number", minimum: 0, maximum: 1000, default: 100 },
            nextRefreshAt:         { type: ["integer", "null"] },
            lastRefreshAt:         { type: ["integer"] },
            lastRefreshStatus:     { type: ["string"] },
            lastRefreshHttpStatus: { type: ["integer"] },
            lastRefreshHttpEtag:   { type: ["string", "null"] },
            
        },
        required: ["id", "feedUrl"],
        additionalProperties: false
    },
    statics: {
      fetchAndUpsert: async function(this: ChannelCollection, target: string, signal?: AbortSignal): Promise<{ channel: Channel, entries: ChannelEntry[] }> {
        const url      = props.httpRewrite(target)

        const fetch    = props.httpFetch
        const resp     = await fetch(url, { signal })
        const upstream = await upstreamChannelSchema.parseAsync(await resp.json())

        // upsert the feed itself
        const channel = await this.upsert({
          id: upstream.id,
          feedUrl: upstream.feedUrl,
          htmlUrl: upstream.htmlUrl,
          imageUrl: upstream.imageUrl,
          imageLabel: upstream.imageLabel,

          title: upstream.title,
          description: upstream.description,
          copyright: upstream.copyright,
          language: upstream.language,
          people: upstream.people,
          tags: upstream.tags,
          generator: upstream.generator,

          lastBuildAt: convertDate(upstream.lastBuildAt),
          lastFetchAt: convertDate(upstream.lastFetchAt),
          nextFetchAt: convertDate(upstream.nextFetchAt),

          refreshHP: 100,
          lastRefreshAt: Date.now(),
          lastRefreshStatus: resp.statusText,
          lastRefreshHttpStatus: resp.status,
          lastRefreshHttpEtag: resp.headers.get('etag'),
          nextRefreshAt: add(Date.now(), { hours: 1 }).valueOf()
        })

        // then upsert any new entries
        const entryCollection = getChannelEntryCollection(this.database)
        const entryResults = await entryCollection.bulkUpsert(
          await Promise.all(
            upstream.entries.map(async entry => ({
              ...entry,

              id: await hashId(`${entry.id}-${upstream.id})`),
              guid: entry.id,
              channelId: channel.id,

              fetchedAt: entry.fetchedAt ? new Date(entry.fetchedAt).valueOf() : undefined,
              publishedAt: entry.publishedAt ? new Date(entry.publishedAt).valueOf() : undefined
            }))
          )
        )

        entryResults.error.forEach(err => {
          console.warn('couldnt upsert:', err)
        })

        return { channel, entries: entryResults.success }
      }
    },
    methods: {
      refresh: async function (this: ChannelDocument) {
        const channelCollection = getChannelCollection(this.collection.database)
        await channelCollection.fetchAndUpsert(this.feedUrl)
      }
    },
    autoMigrate: true,
    migrationStrategies: {},
});