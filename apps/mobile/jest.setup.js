jest.mock('@react-native-async-storage/async-storage', () => {
  const storage = {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  };
  return { createAsyncStorage: jest.fn(() => storage) };
});
