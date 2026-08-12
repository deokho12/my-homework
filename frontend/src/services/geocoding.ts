import { KAKAO_REST_API_KEY } from '@/config/kakaoMap';
import type { GeocodeResult } from '@/types/domain';

// Seoul City Hall — used as the anchor point for mock results so they land somewhere plausible
// on a map centered on Seoul (matches the default center used elsewhere, e.g. HospitalMapView).
const MOCK_ANCHOR = { latitude: 37.5665, longitude: 126.978 };

const MOCK_MIN_DELAY_MS = 200;
const MOCK_DELAY_JITTER_MS = 200;

/** Simple deterministic string hash (djb2-ish) so the same query always yields the same mock result. */
function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function buildMockResults(query: string): GeocodeResult[] {
  const baseHash = hashString(query);
  const count = (baseHash % 3) + 1; // 1~3 results, deterministic per query
  const suffixes = [' 12-3', ' 45', ' 78-1'];

  return Array.from({ length: count }, (_, index) => {
    const seed = hashString(`${query}::${index}`);
    // +-0.025 degrees (~2.5km) around the anchor, deterministic per query+index.
    const latOffset = ((seed % 1000) / 1000 - 0.5) * 0.05;
    const lngOffset = (((seed >>> 8) % 1000) / 1000 - 0.5) * 0.05;

    const result: GeocodeResult = {
      id: `mock-${baseHash}-${index}`,
      addressName: `${query}${suffixes[index % suffixes.length]}`,
      latitude: MOCK_ANCHOR.latitude + latOffset,
      longitude: MOCK_ANCHOR.longitude + lngOffset,
    };

    // Give exactly one of the results a road-address variant, like real Kakao results often have.
    if (index === 0) {
      result.roadAddressName = `${query}로 12`;
    }

    return result;
  });
}

interface KakaoAddressDocument {
  address_name: string;
  road_address?: { address_name: string } | null;
  x: string; // longitude
  y: string; // latitude
}

interface KakaoAddressSearchResponse {
  documents: KakaoAddressDocument[];
}

async function searchAddressViaKakao(query: string): Promise<GeocodeResult[]> {
  const response = await fetch(
    `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(query)}`,
    {
      headers: {
        Authorization: `KakaoAK ${KAKAO_REST_API_KEY}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Kakao address search failed with status ${response.status}`);
  }

  const data: KakaoAddressSearchResponse = await response.json();

  // Real response shape: documents[].{ address_name, road_address?.address_name, x (경도/longitude), y (위도/latitude) }.
  // x/y are returned as strings, so they need parsing before use as coordinates.
  return data.documents.map((doc, index) => ({
    id: `${doc.address_name}-${index}`,
    addressName: doc.address_name,
    roadAddressName: doc.road_address?.address_name,
    latitude: parseFloat(doc.y),
    longitude: parseFloat(doc.x),
  }));
}

/**
 * Searches for an address and returns geocoded candidates.
 *
 * Uses the real Kakao Local address search API when EXPO_PUBLIC_KAKAO_REST_API_KEY is configured.
 * Otherwise falls back to a deterministic mock (same query always returns the same fake results),
 * so AddressSearchInput works end-to-end in development without a real API key.
 */
export async function searchAddress(query: string): Promise<GeocodeResult[]> {
  const trimmed = query.trim();
  if (trimmed.length === 0) return [];

  if (KAKAO_REST_API_KEY) {
    try {
      return await searchAddressViaKakao(trimmed);
    } catch (error) {
      console.warn('[geocoding] Kakao address search failed, returning no results', error);
      return [];
    }
  }

  const delay = MOCK_MIN_DELAY_MS + (hashString(trimmed) % MOCK_DELAY_JITTER_MS);
  return new Promise((resolve) => {
    setTimeout(() => resolve(buildMockResults(trimmed)), delay);
  });
}
