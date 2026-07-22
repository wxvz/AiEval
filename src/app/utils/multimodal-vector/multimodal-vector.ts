/**
 * Teaching engine for the Multimodal vector databases optional lab.
 * Fixed catalog + cosine ranking with metadata filters (not a real vector DB).
 */

import { cosineSimilarity } from '../retrieval/similarity';

export type QueryModality = 'image' | 'text';

export interface CatalogItem {
  id: string;
  title: string;
  caption: string;
  tenant: 'shop-a' | 'shop-b';
  category: 'hiking' | 'formal' | 'outerwear';
  waterproof: boolean;
  /** Shared teaching multimodal space: [warm color, outdoor use, waterproof]. */
  textVector: readonly [number, number, number];
  imageVector: readonly [number, number, number];
}

export interface CatalogFilters {
  tenant: 'shop-a' | 'all';
  waterproofOnly: boolean;
}

export interface QueryPreset {
  id: string;
  modality: QueryModality;
  label: string;
  description: string;
  vector: readonly [number, number, number];
}

export interface RankedCatalogItem {
  item: CatalogItem;
  score: number;
}

/** Challenge: photo of a red hiking boot → authorized waterproof match. */
export const CHALLENGE_QUERY_ID = 'image-red-boot';
export const CHALLENGE_TARGET_ID = 'scarlet-waterproof-boot';

export const CATALOG: readonly CatalogItem[] = [
  {
    id: 'red-trail-shoe',
    title: 'Red trail shoe',
    caption: 'Scarlet trail shoe for dry paths',
    tenant: 'shop-a',
    category: 'hiking',
    waterproof: false,
    textVector: [0.85, 0.75, 0.15],
    imageVector: [0.9, 0.7, 0.1],
  },
  {
    id: 'scarlet-waterproof-boot',
    title: 'Scarlet waterproof boot',
    caption: 'Waterproof version of the red hiking boot',
    tenant: 'shop-a',
    category: 'hiking',
    waterproof: true,
    textVector: [0.8, 0.8, 0.9],
    imageVector: [0.85, 0.75, 0.85],
  },
  {
    id: 'red-office-loafer',
    title: 'Red office loafer',
    caption: 'Formal red shoe for indoor wear',
    tenant: 'shop-a',
    category: 'formal',
    waterproof: false,
    textVector: [0.8, 0.1, 0.05],
    imageVector: [0.85, 0.05, 0.0],
  },
  {
    id: 'tenant-b-boot',
    title: 'Private catalog boot',
    caption: 'Visually similar boot from another customer',
    tenant: 'shop-b',
    category: 'hiking',
    waterproof: true,
    textVector: [0.75, 0.78, 0.88],
    imageVector: [0.88, 0.72, 0.82],
  },
  {
    id: 'blue-rain-jacket',
    title: 'Blue rain jacket',
    caption: 'Waterproof jacket, not a boot',
    tenant: 'shop-a',
    category: 'outerwear',
    waterproof: true,
    textVector: [0.1, 0.4, 0.95],
    imageVector: [0.05, 0.35, 0.9],
  },
];

export const QUERY_PRESETS: readonly QueryPreset[] = [
  {
    id: CHALLENGE_QUERY_ID,
    modality: 'image',
    label: 'Photo: red hiking boot',
    description: 'Image query in the shared multimodal space',
    vector: [0.9, 0.72, 0.2],
  },
  {
    id: 'text-waterproof-red',
    modality: 'text',
    label: 'Text: waterproof red trail shoe',
    description: 'Text query asking for a waterproof version',
    vector: [0.82, 0.78, 0.85],
  },
  {
    id: 'text-indoor-red',
    modality: 'text',
    label: 'Text: red indoor formal shoe',
    description: 'Text query that should prefer the loafer',
    vector: [0.82, 0.08, 0.05],
  },
];

export function getQueryPreset(queryId: string): QueryPreset | undefined {
  return QUERY_PRESETS.find((preset) => preset.id === queryId);
}

export function filterCatalog(
  catalog: readonly CatalogItem[],
  filters: CatalogFilters,
): CatalogItem[] {
  return catalog.filter((item) => {
    if (filters.tenant !== 'all' && item.tenant !== filters.tenant) {
      return false;
    }
    if (filters.waterproofOnly && !item.waterproof) {
      return false;
    }
    return true;
  });
}

/**
 * Rank catalog items by cosine similarity against the query vector.
 * Image queries compare to imageVector; text queries compare to textVector.
 */
export function rankCatalog(
  query: QueryPreset,
  filters: CatalogFilters,
  catalog: readonly CatalogItem[] = CATALOG,
  topK = 5,
): RankedCatalogItem[] {
  const candidates = filterCatalog(catalog, filters);
  const queryVector = [...query.vector];

  return candidates
    .map((item) => {
      const itemVector = query.modality === 'image' ? [...item.imageVector] : [...item.textVector];
      return {
        item,
        score: cosineSimilarity(queryVector, itemVector),
      };
    })
    .sort((left, right) => right.score - left.score || left.item.id.localeCompare(right.item.id))
    .slice(0, Math.max(0, topK));
}

/** Challenge solved when authorized waterproof boot ranks first for the photo query. */
export function isChallengeSolved(
  rankings: RankedCatalogItem[],
  queryId: string,
  filters: CatalogFilters,
): boolean {
  if (queryId !== CHALLENGE_QUERY_ID) {
    return false;
  }
  if (filters.tenant !== 'shop-a' || !filters.waterproofOnly) {
    return false;
  }
  return rankings[0]?.item.id === CHALLENGE_TARGET_ID;
}
