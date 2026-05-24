const DEFAULT_TIMEOUT_MS = 5000;
const MAX_HTML_BYTES = 30_000;

type PlaceSearchResult = {
  place_id: string;
  name: string;
  formatted_address?: string;
};

type PlaceDetailsResult = {
  place_id: string;
  name: string;
  website?: string;
  formatted_phone_number?: string;
  formatted_address?: string;
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

function withTimeout(ms = DEFAULT_TIMEOUT_MS): AbortSignal {
  return AbortSignal.timeout(ms);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeWebsite(url: string): string | null {
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

async function getPlaceDetails(
  placeId: string,
  apiKey: string,
): Promise<PlaceDetailsResult | null> {
  const url =
    `https://maps.googleapis.com/maps/api/place/details/json?` +
    `place_id=${encodeURIComponent(placeId)}` +
    `&fields=place_id,name,website,formatted_phone_number,formatted_address` +
    `&key=${encodeURIComponent(apiKey)}`;

  try {
    const response = await fetch(url, { signal: withTimeout() });
    if (!response.ok) {
      return null;
    }

    const json = await response.json();
    if (json.status !== "OK" || !json.result) {
      return null;
    }

    return json.result as PlaceDetailsResult;
  } catch {
    return null;
  }
}

export async function searchPlaces(params: {
  niche: string;
  city: string;
  apiKey: string;
  maxResults?: number;
}) {
  const { niche, city, apiKey, maxResults = 20 } = params;
  const query = `${niche} ${city}`;
  const url =
    `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}` +
    `&type=establishment&key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url, { signal: withTimeout() });
  if (!response.ok) {
    throw new Error(`Google Places search failed with status ${response.status}`);
  }

  const data = await response.json();
  const rawResults = (data.results ?? []) as PlaceSearchResult[];
  const topResults = rawResults.slice(0, maxResults);

  const detailedResults = await Promise.all(
    topResults.map((place) => getPlaceDetails(place.place_id, apiKey)),
  );

  return detailedResults.filter(
    (place): place is PlaceDetailsResult => Boolean(place?.website),
  );
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
    if (
      activeChecks.has("pagespeed") &&
      pageSpeed !== null &&
      pageSpeed < 50
    ) {
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
