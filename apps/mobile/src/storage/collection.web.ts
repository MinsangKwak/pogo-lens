import {createCollection, deserializeCollection, serializeCollection, type CollectionState} from '@pogo-lens/workflow';

// 웹 체험 기록은 현재 탭의 메모리에만 두며 새로고침하면 초기화된다
let collectionJSON: string | null = null;

export async function loadCollection(): Promise<CollectionState> {
  return collectionJSON === null ? createCollection() : deserializeCollection(collectionJSON);
}

export async function saveCollection(collection: CollectionState): Promise<void> {
  collectionJSON = serializeCollection(collection);
}

export async function deleteCollection(): Promise<void> {
  collectionJSON = null;
}

export async function readCollectionJSON(): Promise<string | null> {
  return collectionJSON;
}
