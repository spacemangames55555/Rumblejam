// Merged item catalog. Packs are data-only modules validated by
// tools/validate_items.mjs (see README dev tools).
import { PART as A } from './items_pack_a.js';
import { PART as B } from './items_pack_b.js';
import { PART as C } from './items_pack_c.js';

export const ITEMS = [...A, ...B, ...C];
export const ITEM_BY_ID = Object.fromEntries(ITEMS.map(it => [it.id, it]));
