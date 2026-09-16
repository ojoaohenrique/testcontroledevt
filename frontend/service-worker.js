const CACHE_NAME = "gml-viaturas-cache-v8";
const STATIC_CACHE = "gml-static-v8";
const API_CACHE = "gml-api-v8";

const ASSETS_TO_CACHE = [
    "/",
    "/login.html",
    "/dashboard.html",
    "/viaturas.html",
    "/relatorio-diario.html",
    "/ordens-servico.html",
    "/css/base.css",
    "/css/login.css",
    "/css/viaturas.css",
    "/css/dashboard.css",
    "/css/layout.css",
    "/css/modulos.css",
    "/js/config.js",
    "/js/supabaseClient.js",
    "/js/auth.js",
    "/js/api.js",
    "/js/utils.js",
    "/js/dadosComuns.js",
    "/js/dashboard.js",
    "/js/viaturas.js",
    "/js/relatorioDiario.js",
    "/js/ordensServico.js",
    "/js/pwa.js",
    "/js/components/layout.js",
    "/js/components/pdf.js",
    "/js/components/headerUsuario.js",
    "/manifest.json",
    "/icons/icon-192x192.png",
    "/icons/icon-512x512.png",
];

// Install event - cache static assets
self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => {
                console.log("[SW] Caching static assets");
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .catch((err) => console.error("[SW] Cache failed:", err))
    );
    self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
    const currentCaches = [STATIC_CACHE, API_CACHE];
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((key) => !currentCaches.includes(key))
                    .map((key) => {
                        console.log("[SW] Deleting old cache:", key);
                        return caches.delete(key);
                    })
            )
        )
    );
    self.clients.claim();
});

// Fetch event - handle requests with different strategies
self.addEventListener("fetch", (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== "GET") {
        return;
    }

    // API requests - Network First with cache fallback
    if (url.pathname.startsWith("/api/")) {
        event.respondWith(handleAPIRequest(request));
        return;
    }

    // JavaScript files: Use Network First strategy to ensure logic is always up-to-date.
    if (url.pathname.endsWith(".js")) {
        event.respondWith(handlePageRequest(request));
        return;
    }

    // Other static assets (CSS, images): Use Cache First for performance.
    else if (isStaticAsset(url)) {
        event.respondWith(handleStaticRequest(request));
        return;
    }

    // HTML pages - Network First (for freshness)
    if (request.mode === "navigate" || request.headers.get("accept")?.includes("text/html")) {
        event.respondWith(handlePageRequest(request));
        return;
    }

    // Default: Cache First
    event.respondWith(
        caches.match(request).then((cached) => cached || fetch(request))
    );
});

// Handle API requests with Network First strategy
async function handleAPIRequest(request) {
    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const cache = await caches.open(API_CACHE);
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        console.log("[SW] API request failed, trying cache:", request.url);
        const cached = await caches.match(request);
        if (cached) {
            return cached;
        }
        // Return offline response for API
        return new Response(
            JSON.stringify({ error: "Offline - No cached data available" }),
            { status: 503, headers: { "Content-Type": "application/json" } }
        );
    }
}

// Handle static assets with Cache First strategy
async function handleStaticRequest(request) {
    const cached = await caches.match(request);
    if (cached) {
        // Update cache in background
        fetch(request)
            .then((response) => {
                if (response.ok) {
                    caches.open(STATIC_CACHE).then((cache) => {
                        cache.put(request, response);
                    });
                }
            })
            .catch(() => { });
        return cached;
    }
    return fetch(request);
}

// Handle page requests with Network First strategy
async function handlePageRequest(request) {
    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const cache = await caches.open(STATIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        console.log("[SW] Page request failed, serving from cache:", request.url);
        const cached = await caches.match(request);
        if (cached) {
            return cached;
        }
        // Return offline page if available
        const offlinePage = await caches.match("/login.html");
        if (offlinePage) {
            return offlinePage;
        }
        return new Response("Offline - Please check your connection", {
            status: 503,
            headers: { "Content-Type": "text/plain" }
        });
    }
}

// Check if URL is a static asset
function isStaticAsset(url) {
    const staticExtensions = [".css", ".js", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".woff", ".woff2", ".ttf"];
    return staticExtensions.some((ext) => url.pathname.endsWith(ext));
}

// Background Sync for offline form submissions
self.addEventListener("sync", (event) => {
    if (event.tag === "sync-forms") {
        event.waitUntil(syncFormSubmissions());
    }
});

// Handle push notifications (optional)
self.addEventListener("push", (event) => {
    const data = event.data?.json() || {};
    event.waitUntil(
        self.registration.showNotification(data.title || "GML Viaturas", {
            body: data.body || "Nova notificação",
            icon: "/icons/icon-192x192.png",
            badge: "/icons/icon-72x72.png",
            data: data.data || {},
        })
    );
});

// Handle notification clicks
self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow(event.notification.data?.url || "/")
    );
});

// Placeholder for form sync functionality
async function syncFormSubmissions() {
    console.log("[SW] Syncing form submissions...");
    // Implement form sync logic here if needed
}
