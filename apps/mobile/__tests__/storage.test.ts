import { createAsyncStorage } from '@react-native-async-storage/async-storage';
import { createCollection } from '@pogo-lens/workflow';
import {
  deleteCollection,
  loadCollection,
  saveCollection,
} from '../src/storage/collection';

const storage = createAsyncStorage('pogoLens');

beforeEach(() => jest.clearAllMocks());

test('a new install reads an empty collection without implicitly saving it', async () => {
  jest.mocked(storage.getItem).mockResolvedValueOnce(null);
  expect((await loadCollection()).records).toEqual([]);
  expect(storage.setItem).not.toHaveBeenCalled();
});

test.each([
  'broken-json',
  JSON.stringify({ ...createCollection(), schemaVersion: 99 }),
])('corrupt or newer data is rejected and never overwritten', async raw => {
  jest.mocked(storage.getItem).mockResolvedValueOnce(raw);
  await expect(loadCollection()).rejects.toThrow();
  expect(storage.setItem).not.toHaveBeenCalled();
  expect(storage.removeItem).not.toHaveBeenCalled();
});

test('save serializes the durable collection and propagates write failures', async () => {
  jest.mocked(storage.setItem).mockRejectedValueOnce(new Error('disk full'));
  await expect(saveCollection(createCollection())).rejects.toThrow('disk full');
  expect(storage.removeItem).not.toHaveBeenCalled();
});

test('explicit delete only removes the collection key', async () => {
  await deleteCollection();
  expect(storage.removeItem).toHaveBeenCalledWith('collection');
});
