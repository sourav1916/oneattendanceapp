const asyncStorageMemory = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(key => Promise.resolve(asyncStorageMemory[key] ?? null)),
    setItem: jest.fn((key, value) => {
      asyncStorageMemory[key] = value;
      return Promise.resolve();
    }),
    removeItem: jest.fn(key => {
      delete asyncStorageMemory[key];
      return Promise.resolve();
    }),
    getMany: jest.fn(keys =>
      Promise.resolve(
        keys.reduce((acc, k) => {
          acc[k] = asyncStorageMemory[k] ?? null;
          return acc;
        }, {}),
      ),
    ),
    setMany: jest.fn(entries => {
      Object.assign(asyncStorageMemory, entries);
      return Promise.resolve();
    }),
    removeMany: jest.fn(keys => {
      for (const k of keys) {
        delete asyncStorageMemory[k];
      }
      return Promise.resolve();
    }),
  },
}));

jest.mock('react-native-localize', () => ({
  getLocales: () => [{ languageCode: 'en', countryCode: 'US' }],
}));

jest.mock('react-native-geolocation-service', () => ({
  __esModule: true,
  default: {
    getCurrentPosition: jest.fn((_success, error) => {
      if (error) {
        error({ code: 1, message: 'mock' });
      }
    }),
  },
}));
