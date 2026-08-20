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

  test('opens Teams panel with roster and run controls', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('nav-agents').click();
    await expect(page.getByTestId('teams-panel')).toBeVisible();
    await expect(page.getByText(/Run multi-agent team/i).first()).toBeVisible();
    await expect(page.getByTestId('agent-roster')).toBeVisible();
    await expect(page.getByTestId('team-task-input')).toBeVisible();
    await expect(page.getByTestId('team-run-btn')).toBeVisible();
    await expect(page.getByText(/director|researcher|coder/i).first()).toBeVisible();
  });

  test('opens Automations with team workflow demo', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('nav-workflows').click();
    await expect(page.getByTestId('workflows-panel')).toBeVisible();
    await expect(page.getByTestId('workflow-team-demo-btn')).toBeVisible();
    await expect(page.getByText(/handoff, team/i).first()).toBeVisible();
  });

  test('opens LLM picker from composer', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('llm-picker').click();
    await expect(page.getByText(/LLM profiles|Select a model|ollama|OpenAI|profiles/i).first()).toBeVisible();
  });
});
