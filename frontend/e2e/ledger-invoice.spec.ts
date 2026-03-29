import { test, expect, expectSuccess, uniqueSku, uniqueGstin } from './fixtures';

test.describe('Create Invoice from Ledger View', () => {
  /**
   * Helper: set up a product with inventory and a ledger, then navigate to ledger view.
   */
  async function seedAndNavigateToLedger(page: import('@playwright/test').Page) {
    const sku = uniqueSku();
    const productName = `LI-Prod ${sku}`;
    const ledgerName = `LI-Ledger-${Date.now().toString(36)}`;

    // 1. Create product
    await page.click('[href="/products"]');
    await page.fill('#sku', sku);
    await page.fill('#name', productName);
    await page.fill('#price', '500');
    await page.fill('#gst-rate', '18');
    await page.click('button:has-text("Create product")');
    await expectSuccess(page, 'Product created');

    // 2. Add inventory
    await page.click('[href="/inventory"]');
    await page.waitForTimeout(500);
    const productSelect = page.locator('#inventory-product');
    const options = productSelect.locator('option');
    const count = await options.count();
    for (let i = 0; i < count; i++) {
      const text = await options.nth(i).textContent();
      if (text?.includes(sku)) {
        const val = (await options.nth(i).getAttribute('value')) || '';
        await productSelect.selectOption(val);
        break;
      }
    }
    await page.fill('#inventory-quantity', '100');
    await page.click('button:has-text("Apply adjustment")');
    await expectSuccess(page, 'Inventory updated');

    // 3. Create ledger
    await page.click('[href="/ledgers"]');
    await page.click('button:has-text("Create ledger")');
    await expect(page.locator('h1')).toContainText('Create ledger', { timeout: 10_000 });
    await page.fill('#ledger-name', ledgerName);
    await page.fill('#ledger-address', '111 Invoice Lane');
    await page.fill('#ledger-gst', uniqueGstin());
    await page.fill('#ledger-phone', '+91 3333333333');
    await page.click('button:has-text("Create ledger")');
    await expect(page.locator('h1')).toContainText('Ledger master', { timeout: 10_000 });
    await expectSuccess(page, 'Ledger created');

    // 4. Navigate to ledger view
    const row = page.locator('.table-row', { hasText: ledgerName });
    await row.locator('button:has-text("View")').click();
    await expect(page.locator('h1')).toContainText(ledgerName, { timeout: 10_000 });

    return { sku, productName, ledgerName };
  }

  test('creates a sales invoice from ledger view and sees it in statement', async ({ authedPage: page }) => {
    const { sku, ledgerName } = await seedAndNavigateToLedger(page);

    // Open the Create Invoice modal
    await page.click('button:has-text("Create Invoice")');
    const modal = page.locator('.modal-overlay');
    await expect(modal).toBeVisible({ timeout: 5_000 });

    // Verify modal title
    await expect(modal.locator('#create-invoice-modal-title')).toContainText('Create invoice');

    // Voucher type should default to sales
    await expect(modal.locator('#modal-inv-voucher-type')).toHaveValue('sales');

    // Ledger should be pre-selected (disabled)
    const ledgerSelect = modal.locator('#modal-inv-ledger');
    await expect(ledgerSelect).toBeDisabled();

    // Select product in first line item
    const productSelect = modal.locator('[id^="modal-inv-product-"]').first();
    const prodOptions = productSelect.locator('option');
    const prodCount = await prodOptions.count();
    for (let i = 0; i < prodCount; i++) {
      const text = await prodOptions.nth(i).textContent();
      if (text?.includes(sku)) {
        const val = (await prodOptions.nth(i).getAttribute('value')) || '';
        await productSelect.selectOption(val);
        break;
      }
    }

    // Set quantity
    await modal.locator('[id^="modal-inv-qty-"]').first().fill('2');

    // Submit
    await modal.locator('button:has-text("Create invoice")').click();
    await expect(modal).not.toBeVisible({ timeout: 10_000 });

    // Wait for statement refresh and verify entry appears
    await page.waitForTimeout(1_500);
    const salesEntry = page.locator('.invoice-row').filter({ hasText: 'Sales' });
    await expect(salesEntry.first()).toBeVisible({ timeout: 10_000 });
    await expect(salesEntry.first()).toContainText('Dr');
  });

  test('creates a purchase invoice from ledger view', async ({ authedPage: page }) => {
    const { sku } = await seedAndNavigateToLedger(page);

    // Open the Create Invoice modal
    await page.click('button:has-text("Create Invoice")');
    const modal = page.locator('.modal-overlay');
    await expect(modal).toBeVisible({ timeout: 5_000 });

    // Switch to purchase
    await modal.locator('#modal-inv-voucher-type').selectOption('purchase');

    // Select product
    const productSelect = modal.locator('[id^="modal-inv-product-"]').first();
    const prodOptions = productSelect.locator('option');
    const prodCount = await prodOptions.count();
    for (let i = 0; i < prodCount; i++) {
      const text = await prodOptions.nth(i).textContent();
      if (text?.includes(sku)) {
        const val = (await prodOptions.nth(i).getAttribute('value')) || '';
        await productSelect.selectOption(val);
        break;
      }
    }

    await modal.locator('[id^="modal-inv-qty-"]').first().fill('5');

    // Submit
    await modal.locator('button:has-text("Create invoice")').click();
    await expect(modal).not.toBeVisible({ timeout: 10_000 });

    // Verify purchase entry appears as Credit
    await page.waitForTimeout(1_500);
    const purchaseEntry = page.locator('.invoice-row').filter({ hasText: 'Purchase' });
    await expect(purchaseEntry.first()).toBeVisible({ timeout: 10_000 });
    await expect(purchaseEntry.first()).toContainText('Cr');
  });

  test('can close modal without creating invoice', async ({ authedPage: page }) => {
    await seedAndNavigateToLedger(page);

    await page.click('button:has-text("Create Invoice")');
    const modal = page.locator('.modal-overlay');
    await expect(modal).toBeVisible({ timeout: 5_000 });

    // Click cancel
    await modal.locator('button:has-text("Cancel")').click();
    await expect(modal).not.toBeVisible({ timeout: 3_000 });
  });
});
