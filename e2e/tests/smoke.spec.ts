import { test, expect } from '@playwright/test';

/**
 * UI smoke E2E — full browser against Next client + API.
 * Does not call LLMs (avoids flaky provider / key dependency).
 */
test.describe('App smoke', () => {
  test('loads studio shell with brand + composer', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('app-brand')).toBeVisible();
    await expect(page.getByTestId('chat-composer')).toBeVisible();
    await expect(page.getByTestId('chat-input')).toBeVisible();
    await expect(page.getByTestId('new-chat')).toBeVisible();
  });

  test('composer accepts input and enables send', async ({ page }) => {
    await page.goto('/');
    const input = page.getByTestId('chat-input');
    const send = page.getByTestId('chat-send');
    await expect(send).toBeDisabled();
    await input.fill('hello from e2e');
    await expect(send).toBeEnabled();
  });

  test('navigates primary workspace sections', async ({ page }) => {
    await page.goto('/');

    await page.getByTestId('nav-settings').click();
    await expect(page.getByText(/Available profiles|LLM|Workspace|Skills/i).first()).toBeVisible();

    await page.getByTestId('nav-servers').click();
    await expect(page.getByText(/MCP|Servers|Connect/i).first()).toBeVisible();

    await page.getByTestId('nav-observability').click();
    await expect(page.getByText(/Observability|timeline|evaluation|Agent/i).first()).toBeVisible();
  });

  test('opens LLM picker from composer', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('llm-picker').click();
    await expect(page.getByText(/LLM profiles|Select a model|ollama|OpenAI|profiles/i).first()).toBeVisible();
  });
});
