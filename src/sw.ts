export const VERSION = "1.2.0";
const CACHE_NAME = "v-pool-laps";
const CONTENT_TO_CACHE = [
    "./bundle.js",
    "./icons/1024.png",
    "./index.html",
    "./manifest.json",
    "./page-stack.css",
    "./style.css",
    "./sw.js",
];

const feedCache = (e: ExtendableEvent): void => {
    e.waitUntil(
        (async () => {
            const cache = await caches.open(CACHE_NAME);
            console.log("[Service Worker] Caching all: app shell and content");
            await cache.addAll(CONTENT_TO_CACHE);
        })(),
    );
};

const serveFromCache = (e: FetchEvent): void => {
    console.log("[Service Worker] serveFromCache");
    // Cache http and https only, skip unsupported chrome-extension:// and file://...
    const url: string = e.request.url;
    if (!(url.startsWith("http:") || url.startsWith("https:"))) {
        return;
    }

    e.respondWith(
        (async () => {
            const r = await caches.match(e.request);
            console.log(`[Service Worker] Fetching resource: ${e.request.url}`);
            if (r != null) {
                return r;
            }
            const response = await fetch(e.request);
            const cache = await caches.open(CACHE_NAME);
            console.log(`[Service Worker] Caching new resource: ${e.request.url}`);
            void cache.put(e.request, response.clone());
            return response;
        })(),
    );
};

// Fetching content using Service Worker
self.addEventListener("fetch", serveFromCache);

self.addEventListener("install", feedCache);
