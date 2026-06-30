import Config from 'react-native-config';

const PROD_API_URL = 'http://101.50.86.169/api';
const DEV_API_URL = 'http://127.0.0.1:5001/api';

const ENV = String((Config as unknown as { ENV?: unknown }).ENV ?? '')
  .trim()
  .toUpperCase();

const isProdEnv = ENV === 'PROD' || ENV === 'PRODUCTION';

/**
 * Release builds (`assembleRelease`) always use PROD_API_URL.
 * Debug builds: ENV=PROD → VM, otherwise local backend.
 */
export const API_URL = !__DEV__ || isProdEnv ? PROD_API_URL : DEV_API_URL;
