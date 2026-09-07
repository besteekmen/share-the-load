import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './chores/browser_tests',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:8001',
    browserName: 'chromium',
    timezoneId: 'America/New_York',
    locale: 'en-US',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'uv run python manage.py runserver 127.0.0.1:8001 --noreload',
    url: 'http://127.0.0.1:8001',
    reuseExistingServer: false,
  },
});
