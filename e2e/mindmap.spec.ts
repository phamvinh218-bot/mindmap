import { test, expect, type Page } from '@playwright/test';
import { E2E_PASSWORD } from '../playwright.config';

async function ownerLogin(page: Page) {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('Mật khẩu').fill(E2E_PASSWORD);
  await page.getByRole('button', { name: 'Mở' }).click();
  await expect(page.getByRole('heading', { name: 'Mindmap của tôi' })).toBeVisible();
}

const node = (page: Page, text: string) => page.locator('.react-flow__node').filter({ hasText: text });

async function addNode(page: Page, key: 'Tab' | 'Enter', text: string) {
  await page.keyboard.press(key);
  const input = page.getByRole('textbox', { name: 'Nội dung ý' });
  await expect(input).toBeFocused();
  await input.fill(text);
  await input.press('Enter');
  await expect(node(page, text)).toBeVisible();
}

async function createShare(page: Page, permission: 'Được sửa' | 'Chỉ xem', password: string): Promise<string> {
  await page.getByRole('button', { name: 'Chia sẻ' }).click();
  const dialog = page.getByRole('dialog', { name: 'Chia sẻ mindmap' });
  const links = dialog.getByLabel('Link chia sẻ');
  await expect(dialog.getByText(/Chưa có link nào|Các link đã tạo/).first()).toBeVisible();
  await expect(dialog.getByText('Đang tải…')).toHaveCount(0);
  const before = await links.count();
  await dialog.getByLabel('Quyền', { exact: true }).selectOption({ label: permission });
  await dialog.getByLabel('Mật khẩu cho link').fill(password);
  await dialog.getByRole('button', { name: 'Tạo link' }).click();
  await expect(links).toHaveCount(before + 1);
  const url = await links.last().inputValue();
  await dialog.getByRole('button', { name: 'Đóng' }).click();
  return url;
}

test('owner builds a map, shares it, partner edits, owner sees a conflict', async ({ page, browser }) => {
  await ownerLogin(page);

  // create
  await page.getByRole('button', { name: '+ Mindmap mới' }).click();
  await page.getByRole('dialog', { name: 'Mindmap mới' }).getByRole('textbox').fill('Dự án thử');
  await page.getByRole('button', { name: 'Tạo' }).click();
  await expect(page).toHaveURL(/\/m\/[0-9a-f-]{36}$/);

  // three nodes
  await node(page, 'Dự án thử').click();
  await addNode(page, 'Tab', 'Mục tiêu');
  await addNode(page, 'Enter', 'Nhân sự');
  await addNode(page, 'Tab', 'Tuyển dev');

  // color one
  await node(page, 'Nhân sự').click();
  await page.getByRole('button', { name: 'Màu #10b981' }).click();
  await expect(node(page, 'Nhân sự').locator('.mm-node-wrap')).toHaveAttribute('style', /#10b981/i);

  // connect two nodes across branches
  await node(page, 'Tuyển dev').click();
  await page.getByRole('button', { name: 'Nối' }).click();
  await node(page, 'Mục tiêu').click();
  await expect(page.locator('.react-flow__edge-link')).toHaveCount(1);

  await expect(page.getByText('Đã lưu')).toBeVisible();

  // share (edit) and view links
  const editUrl = await createShare(page, 'Được sửa', 'bimat1');
  const viewUrl = await createShare(page, 'Chỉ xem', 'xem123');

  // partner in a separate browser context
  const partnerCtx = await browser.newContext();
  const partner = await partnerCtx.newPage();
  await partner.goto(editUrl);
  await expect(partner.getByText('Nhập mật khẩu để mở «Dự án thử»')).toBeVisible();
  await partner.getByLabel('Mật khẩu').fill('sai');
  await partner.getByRole('button', { name: 'Mở' }).click();
  await expect(partner.getByText('Sai mật khẩu')).toBeVisible();
  await partner.getByLabel('Mật khẩu').fill('bimat1');
  await partner.getByRole('button', { name: 'Mở' }).click();
  await expect(partner.getByText('Được sửa')).toBeVisible();
  await expect(node(partner, 'Tuyển dev')).toBeVisible();

  // partner edits and saves
  await node(partner, 'Mục tiêu').click();
  await addNode(partner, 'Tab', 'Ý của partner');
  await expect(partner.getByText('Đã lưu')).toBeVisible();

  // owner, still on the old version, edits → conflict
  await node(page, 'Nhân sự').dblclick();
  const input = page.getByRole('textbox', { name: 'Nội dung ý' });
  await input.fill('Nhân sự (sửa)');
  await input.press('Enter');
  await expect(page.getByText('Có người vừa lưu phiên bản mới hơn')).toBeVisible();
  await page.getByRole('button', { name: 'Tải bản mới' }).click();
  await expect(node(page, 'Ý của partner')).toBeVisible();

  // view-only link
  const viewerCtx = await browser.newContext();
  const viewer = await viewerCtx.newPage();
  await viewer.goto(viewUrl);
  await viewer.getByLabel('Mật khẩu').fill('xem123');
  await viewer.getByRole('button', { name: 'Mở' }).click();
  await expect(viewer.getByText('Chỉ xem')).toBeVisible();
  await node(viewer, 'Mục tiêu').dblclick();
  await expect(viewer.getByRole('textbox', { name: 'Nội dung ý' })).toHaveCount(0);
  await expect(viewer.getByRole('button', { name: 'Sắp xếp gọn' })).toHaveCount(0);

  await partnerCtx.close();
  await viewerCtx.close();
});

test('unauthenticated API and pages are locked', async ({ request, page }) => {
  expect((await request.get('/api/maps')).status()).toBe(401);
  await page.goto('/m/00000000-0000-0000-0000-000000000000');
  await expect(page).toHaveURL(/\/login$/);
  expect((await request.get('/api/cron/daily')).status()).toBe(401);
  expect((await request.get('/api/cron/daily', { headers: { authorization: 'Bearer e2e-cron' } })).status()).toBe(200);
});
