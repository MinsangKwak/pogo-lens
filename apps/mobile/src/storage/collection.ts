import { createAsyncStorage } from '@react-native-async-storage/async-storage';
import {
  createCollection,
  deserializeCollection,
  serializeCollection,
  type CollectionState,
} from '@pogo-lens/workflow';

const storage = createAsyncStorage('pogoLens');
const collectionKey = 'collection';

export async function loadCollection(): Promise<CollectionState> {
  const raw = await storage.getItem(collectionKey);
  return raw === null ? createCollection() : deserializeCollection(raw);
}

export async function saveCollection(
  collection: CollectionState,
): Promise<void> {
  await storage.setItem(collectionKey, serializeCollection(collection));
}

export async function deleteCollection(): Promise<void> {
  await storage.removeItem(collectionKey);
}

export async function readCollectionJSON(): Promise<string | null> {
  return storage.getItem(collectionKey);
}
