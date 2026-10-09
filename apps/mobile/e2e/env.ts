// Before any module loads: no analytics key (nothing is sent), and the API the fake answers.
process.env.EXPO_PUBLIC_POSTHOG_KEY = '';
process.env.EXPO_PUBLIC_API_URL = 'http://api.loro.test/v1';
process.env.TZ = 'UTC';
