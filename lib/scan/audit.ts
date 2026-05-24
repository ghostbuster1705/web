const DEFAULT_TIMEOUT_MS = 5000;
const MAX_HTML_BYTES = 30_000;
const OSM_SEARCH_RADIUS_METERS = 12_000;

type PlaceDetailsResult = {
  place_id: string;
  name: string;
  website?: string;
  formatted_phone_number?: string;
  formatted_address?: string;
};

type NominatimCityResult = {
  lat: string;
  lon: string;
};

type OverpassElement = {
  id: number;
  type: string;
  tags?: Record<string, string>;
};

export type LeadAuditResult = {
  businessName: string;
  websiteUrl: string;
  phone: string | null;
  address: string | null;
  googlePlaceId: string;
  score: number;
  issues: string[];
  techStack: string[];
  pageSpeed: number | null;
  hasHttps: boolean;
  hasMobile: boolean;
  hasAnalytics: boolean;
  lastModifiedYear: number | null;
};

const CHECK_KEYS = [
  "https",
  "mobile",
  "pagespeed",
  "copyright",
  "analytics",
  "social",
] as const;

type CheckKey = (typeof CHECK_KEYS)[number];

const OSM_HEADERS = {
  "User-Agent": "SiteAuditPro/1.0 (https://siteaudit-pro.app)",
  "Accept-Language": "de,en;q=0.8",
};

function withTimeout(ms = DEFAULT_TIMEOUT_MS): AbortSignal {
  return AbortSignal.timeout(ms);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeWebsite(url: string): string | null {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    return parsed.toString();
  } catch {
    try {
      const parsed = new URL(`https://${url}`);
      return parsed.toString();
    } catch {
      return null;
    }
  }
}

function nicheTokens(niche: string): string[] {
  return niche
    .toLowerCase()
    .split(/[\s,/.-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2);
}

function matchesNiche(tags: Record<string, string>, niche: string): boolean {
  const tokens = nicheTokens(niche);
  if (tokens.length === 0) return true;

  const haystack = [
    tags.name,
    tags.shop,
    tags.amenity,
    tags.office,
    tags.craft,
    tags.tourism,
    tags.leisure,
    tags.cuisine,
    tags.description,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return tokens.some((token) => haystack.includes(token));
}

function formatAddress(tags: Record<string, string>, city: string): string {
  const parts = [
    [tags["addr:street"], tags["addr:housenumber"]].filter(Boolean).join(" "),
    tags["addr:postcode"],
    tags["addr:city"] ?? city,
  ].filter(Boolean);

  if (parts.length === 0) {
    return city;
  }

  return parts.join(", ");
}

function mapOverpassElement(
  element: OverpassElement,
  city: string,
): PlaceDetailsResult | null {
  const tags = element.tags;
  if (!tags?.name) return null;

  const website = normalizeWebsite(tags.website ?? tags["contact:website"] ?? "");
  if (!website) return null;

  return {
    place_id: `${element.type}/${element.id}`,
    name: tags.name,
    website,
    formatted_phone_number: tags.phone ?? tags["contact:phone"],
    formatted_address: formatAddress(tags, city),
  };
}

async function getCityCoordinates(city: string) {
  const url =
    "https://nominatim.openstreetmap.org/search" +
    `?format=jsonv2&limit=1&countrycodes=de&q=${encodeURIComponent(`${city}, Germany`)}`;

  const response = await fetch(url, {
    headers: OSM_HEADERS,
    signal: withTimeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`Nominatim lookup failed with status ${response.status}`);
  }

  const results = (await response.json()) as NominatimCityResult[];
  if (!Array.isArray(results) || results.length === 0) {
    throw new Error("City not found in OpenStreetMap");
  }

  const lat = Number(results[0].lat);
  const lon = Number(results[0].lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error("Invalid city coordinates from OpenStreetMap");
  }

  return { lat, lon };
}

export async function searchPlaces(params: {
  niche: string;
  city: string;
  maxResults?: number;
}) {
  const { niche, city, maxResults = 20 } = params;
  const { lat, lon } = await getCityCoordinates(city);

  const overpassQuery = `
[out:json][timeout:25];
(
  node["name"]["website"](around:${OSM_SEARCH_RADIUS_METERS},${lat},${lon});
  way["name"]["website"](around:${OSM_SEARCH_RADIUS_METERS},${lat},${lon});
  relation["name"]["website"](around:${OSM_SEARCH_RADIUS_METERS},${lat},${lon});
  node["name"]["contact:website"](around:${OSM_SEARCH_RADIUS_METERS},${lat},${lon});
  way["name"]["contact:website"](around:${OSM_SEARCH_RADIUS_METERS},${lat},${lon});
  relation["name"]["contact:website"](around:${OSM_SEARCH_RADIUS_METERS},${lat},${lon});
);
out tags center;
`.trim();

  const response = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      ...OSM_HEADERS,
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
    },
    body: new URLSearchParams({ data: overpassQuery }),
    signal: withTimeout(20_000),
  });

  if (!response.ok) {
    throw new Error(`Overpass lookup failed with status ${response.status}`);
  }

  const data = await response.json();
  const elements = (Array.isArray(data?.elements)
    ? data.elements
    : []) as OverpassElement[];

  const mapped = elements
    .map((element) => mapOverpassElement(element, city))
    .filter((place): place is PlaceDetailsResult => Boolean(place));

  const nicheFiltered = mapped.filter((place) =>
    matchesNiche(elements.find((el) => `${el.type}/${el.id}` === place.place_id)?.tags ?? {}, niche),
  );

  const selected = (nicheFiltered.length > 0 ? nicheFiltered : mapped).slice(
    0,
    maxResults * 2,
  );

  const dedupedByWebsite = new Map<string, PlaceDetailsResult>();
  for (const place of selected) {
    if (!place.website) continue;
    if (!dedupedByWebsite.has(place.website)) {
      dedupedByWebsite.set(place.website, place);
    }
  }

  return [...dedupedByWebsite.values()].slice(0, maxResults);
}

async function fetchPageSpeed(url: string): Promise<number | null> {
  const endpoint =
    `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?` +
    `url=${encodeURIComponent(url)}&strategy=mobile`;

  try {
    const response = await fetch(endpoint, { signal: withTimeout() });
    if (!response.ok) {
      return null;
    }

    const json = await response.json();
    const score = json?.lighthouseResult?.categories?.performance?.score;
    if (typeof score !== "number") {
      return null;
    }

    return Math.round(score * 100);
  } catch {
    return null;
  }
}

async function checkHttps(url: string): Promise<boolean> {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:") {
      return true;
    }
  } catch {
    return false;
  }

  try {
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: withTimeout(),
    });
    return response.url.startsWith("https://");
  } catch {
    return false;
  }
}

async function fetchHomepageHtml(url: string): Promise<string | null> {
  const response = await fetch(url, {
    redirect: "follow",
    signal: withTimeout(),
    headers: {
      "user-agent": "SiteAuditProBot/1.0 (+https://siteaudit-pro.app)",
      accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    return null;
  }

  const html = await response.text();
  return html.slice(0, MAX_HTML_BYTES);
}

function detectTechStack(html: string): string[] {
  const stack = new Set<string>();

  if (/wp-content|wordpress/i.test(html)) stack.add("WordPress");
  if (/wixstatic|wix\.com/i.test(html)) stack.add("Wix");
  if (/cdn\.shopify|shopify/i.test(html)) stack.add("Shopify");
  if (/webflow/i.test(html)) stack.add("Webflow");
  if (/joomla/i.test(html)) stack.add("Joomla");
  if (/drupal/i.test(html)) stack.add("Drupal");
  if (/elementor/i.test(html)) stack.add("Elementor");

  return [...stack];
}

function resolveChecks(criteria: string[]): Set<CheckKey> {
  const filtered = criteria.filter((value): value is CheckKey =>
    CHECK_KEYS.includes(value as CheckKey),
  );
  if (filtered.length === 0) {
    return new Set(CHECK_KEYS);
  }
  return new Set(filtered);
}

export async function auditBusinessSite(params: {
  businessName: string;
  websiteUrl: string;
  phone?: string;
  address?: string;
  placeId: string;
  criteria: string[];
}): Promise<LeadAuditResult> {
  const normalizedUrl = normalizeWebsite(params.websiteUrl);
  if (!normalizedUrl) {
    return {
      businessName: params.businessName,
      websiteUrl: params.websiteUrl,
      phone: params.phone ?? null,
      address: params.address ?? null,
      googlePlaceId: params.placeId,
      score: 0,
      issues: ["Website unreachable"],
      techStack: [],
      pageSpeed: null,
      hasHttps: false,
      hasMobile: false,
      hasAnalytics: false,
      lastModifiedYear: null,
    };
  }

  const activeChecks = resolveChecks(params.criteria);
  const issues: string[] = [];

  let hasHttps = false;
  let hasMobile = false;
  let hasAnalytics = false;
  let hasSocial = false;
  let pageSpeed: number | null = null;
  let lastModifiedYear: number | null = null;
  let techStack: string[] = [];
  let score = 100;

  try {
    hasHttps = await checkHttps(normalizedUrl);
    if (activeChecks.has("https") && !hasHttps) {
      score -= 25;
      issues.push("No HTTPS detected");
    }

    pageSpeed = await fetchPageSpeed(normalizedUrl);
    if (activeChecks.has("pagespeed") && pageSpeed !== null && pageSpeed < 50) {
      score -= 20;
      issues.push(`PageSpeed mobile score is low (${pageSpeed})`);
    }

    const html = await fetchHomepageHtml(normalizedUrl);
    if (!html) {
      return {
        businessName: params.businessName,
        websiteUrl: normalizedUrl,
        phone: params.phone ?? null,
        address: params.address ?? null,
        googlePlaceId: params.placeId,
        score: 0,
        issues: ["Website unreachable"],
        techStack: [],
        pageSpeed,
        hasHttps,
        hasMobile: false,
        hasAnalytics: false,
        lastModifiedYear: null,
      };
    }

    hasMobile = /<meta[^>]+name=["']viewport["']/i.test(html);
    hasAnalytics =
      /(googletagmanager\.com|gtag\(|google-analytics\.com|ga\('create')/i.test(
        html,
      );
    hasSocial = /(facebook\.com|instagram\.com|linkedin\.com|twitter\.com|x\.com)/i.test(
      html,
    );
    techStack = detectTechStack(html);

    const oldYearMatches = html.match(/\b(200[0-9]|201[0-4])\b/g);
    if (oldYearMatches && oldYearMatches.length > 0) {
      const years = oldYearMatches.map(Number).filter(Boolean);
      lastModifiedYear = Math.max(...years);
    }

    if (activeChecks.has("mobile") && !hasMobile) {
      score -= 25;
      issues.push("Missing viewport meta tag (not mobile-ready)");
    }

    if (
      activeChecks.has("copyright") &&
      lastModifiedYear !== null &&
      lastModifiedYear < 2015
    ) {
      score -= 15;
      issues.push(`Outdated copyright year (${lastModifiedYear})`);
    }

    if (activeChecks.has("analytics") && !hasAnalytics) {
      score -= 10;
      issues.push("No Google Analytics / GTM detected");
    }

    if (activeChecks.has("social") && !hasSocial) {
      score -= 5;
      issues.push("No social profile links detected");
    }

    if (pageSpeed === null) {
      issues.push("PageSpeed score unavailable");
    }
  } catch {
    return {
      businessName: params.businessName,
      websiteUrl: normalizedUrl,
      phone: params.phone ?? null,
      address: params.address ?? null,
      googlePlaceId: params.placeId,
      score: 0,
      issues: ["Website unreachable"],
      techStack: [],
      pageSpeed: null,
      hasHttps,
      hasMobile: false,
      hasAnalytics: false,
      lastModifiedYear: null,
    };
  }

  return {
    businessName: params.businessName,
    websiteUrl: normalizedUrl,
    phone: params.phone ?? null,
    address: params.address ?? null,
    googlePlaceId: params.placeId,
    score: clamp(score, 0, 100),
    issues,
    techStack,
    pageSpeed,
    hasHttps,
    hasMobile,
    hasAnalytics,
    lastModifiedYear,
  };
}
