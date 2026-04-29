import axios from 'axios';
import { fetchAuthSession } from 'aws-amplify/auth';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30000,
});

client.interceptors.request.use(async (config) => {
  try {
    const session = await fetchAuthSession({ forceRefresh: false });
    const token   = session.tokens?.accessToken?.toString();
    if (token) config.headers.Authorization = `Bearer ${token}`;
  } catch {
    // unauthenticated — let the request go through and the server will 401
  }
  return config;
});

export default client;
