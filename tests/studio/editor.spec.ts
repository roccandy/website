import { test, expect, type Page } from "@playwright/test";
import sharp from "sharp";
import { readFile } from "node:fs/promises";
const browserErrors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  browserErrors.set(page, errors);
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Design Studio", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  // Fail each test if a component crashes, including after a pointer gesture.
});
test.afterEach(async ({ page }) => {
  expect(browserErrors.get(page)).toEqual([]);
});

test("saves complex jackets and layer controls with flat and presentation views", async ({
  page,
}) => {
  await page.getByLabel("Jacket pattern").selectOption("segments");
  await page.getByLabel("Jacket segments", { exact: true }).fill("12");
  await page.getByLabel("Jacket ring thickness (%)").fill("25");
  await page.getByLabel("Show pinstripes", { exact: true }).check();
  await page.getByLabel("Pinstripe width (% of segment)").fill("30");
  await page
    .getByRole("textbox", { name: "Text", exact: true })
    .fill("THANK YOU KARRI");
  await page.getByLabel("Opacity (%)").fill("75");
  await page.getByLabel("Text layout").selectOption("up");
  await page.getByLabel("Arc radius", { exact: true }).fill("280");
  await page.getByLabel("Arc slide (%)").fill("10");
  await page
    .getByRole("button", { name: "Fit text to face", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Save & use in order", exact: true })
    .click();
  await expect(page.getByTestId("applied")).toContainText('"schemaVersion":2');
  const saved = JSON.parse(
    (await page.getByTestId("applied").textContent()) || "null",
  );
  expect(saved.schemaVersion).toBe(2);
  expect(saved.jacket.advanced).toMatchObject({
    segments: 12,
    ring: 0.25,
    gap: 0.3,
  });
  expect(saved.layers[0]).toMatchObject({
    text: "THANK YOU KARRI",
    opacity: 0.75,
    arcRadius: 280,
    arcOffset: 0,
  });
  await page.screenshot({
    path: "test-results/studio-complex-3d.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Flat face", exact: true }).click();
  await expect(
    page.locator("[data-advanced-jacket] [data-jacket-body]"),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Present", exact: true }).click();
  await expect(page.getByLabel("Design name", { exact: true })).toBeHidden();
  await expect(page.locator("[data-design-handle]")).toHaveCount(0);
  await page.getByRole("button", { name: "Return to editing" }).click();
  await expect(page.getByLabel("Design name", { exact: true })).toBeVisible();
});

test("image editing, selection split, paint, undo and project round trip preserve artwork", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Paint face", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "Edit artwork pixels" });
  const canvas = modal.getByLabel("Artwork editing canvas");
  await expect(canvas).toBeVisible();
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5, {
    steps: 5,
  });
  await page.mouse.up();
  await modal
    .getByRole("button", { name: "Magic select", exact: true })
    .click();
  await canvas.click({ position: { x: box.width / 2, y: box.height / 2 } });
  await modal
    .getByRole("button", { name: "Split to new layer", exact: true })
    .click();
  const copied = modal.getByText(
    "The selected artwork will be added as a separate layer when you apply.",
  );
  await expect(copied).toBeVisible();
  await modal.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(copied).toBeHidden();
  await modal.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(copied).toBeVisible();
  await modal
    .getByRole("button", { name: "Apply artwork", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Save & use in order", exact: true })
    .click();
  await expect(page.getByTestId("applied")).toContainText(
    "Face paint selection",
  );
  let saved = JSON.parse(
    (await page.getByTestId("applied").textContent()) || "null",
  );
  expect(saved.layers).toHaveLength(3);
  expect(saved.layers[1].image).toMatch(/^candy-asset:[a-f0-9]{64}\.png$/);
  expect(saved.layers[2].name).toContain("selection");
  await page.getByRole("button", { name: "Paint jacket", exact: true }).click();
  const jacketBox = (await canvas.boundingBox())!;
  await canvas.click({
    position: { x: jacketBox.width * 0.7, y: jacketBox.height * 0.4 },
  });
  await modal.getByRole("button", { name: "Undo", exact: true }).click();
  await modal.getByRole("button", { name: "Redo", exact: true }).click();
  await modal
    .getByRole("button", { name: "Apply artwork", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Save & use in order", exact: true })
    .click();
  await expect(page.getByTestId("applied")).toContainText("Jacket paint");
  saved = JSON.parse(
    (await page.getByTestId("applied").textContent()) || "null",
  );
  expect(saved.layers[3]).toMatchObject({ frame: "scene", surface: "jacket" });
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download project", exact: true })
    .click();
  const file = await download,
    path = (await file.path())!;
  await page
    .locator('input[accept=".json,application/json"]')
    .setInputFiles(path);
  await page
    .getByRole("button", { name: "Save & use in order", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("revision 1");
  const reopened = JSON.parse(
    (await page.getByTestId("applied").textContent()) || "null",
  );
  expect(reopened.layers).toEqual(saved.layers);
});

test("legacy designs retain their geometry until explicitly upgraded and locked layers cannot drag", async ({
  page,
}) => {
  await page.goto("/?legacy");
  await expect(page.locator("[data-advanced-jacket]")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Enable advanced jacket controls" })
    .click();
  await expect(page.locator("[data-advanced-jacket]")).toHaveCount(1);
  await page.getByLabel("Lock position").check();
  const layer = page.locator('[data-design-layer="text-1"]').first();
  const before = await layer.getAttribute("transform");
  const bounds = (await layer.boundingBox())!;
  await page.mouse.move(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(bounds.x + 150, bounds.y + 100, { steps: 4 });
  await page.mouse.up();
  expect(await layer.getAttribute("transform")).toBe(before);
  await page.getByRole("button", { name: "Flat face", exact: true }).click();
  await page.screenshot({
    path: "test-results/studio-flat-face.png",
    fullPage: true,
  });
});

test("supports multiline text and transform handles, with a usable narrow layout", async ({
  page,
}) => {
  await page
    .getByRole("textbox", { name: "Text", exact: true })
    .fill("Thank You\nKarri");
  await page.getByLabel("Uppercase text").check();
  await expect(
    page.locator('[data-design-layer="text-1"] [data-outlined-font] title'),
  ).toHaveText("THANK YOU\nKARRI");
  const resize = page.locator('[data-design-handle="resize"]'),
    r = (await resize.boundingBox())!;
  const initialSize = +(await page.getByLabel("Font size (%)").inputValue());
  await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
  await page.mouse.down();
  await page.mouse.move(r.x + r.width / 2 + 30, r.y + r.height / 2 + 30);
  await page.mouse.up();
  expect(
    +(await page.getByLabel("Font size (%)").inputValue()),
  ).toBeGreaterThan(initialSize);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(+(await page.getByLabel("Font size (%)").inputValue())).toBe(
    initialSize,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("library save cannot silently close with unapplied order artwork, and recovery survives reopening", async ({
  page,
}) => {
  await page.goto("/?embedded&scope=order-a");
  await page
    .getByRole("textbox", { name: "Text", exact: true })
    .fill("UNAPPLIED DESIGN");
  await page
    .getByRole("button", { name: "Save to library", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Saved to library");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(
    page.getByRole("group", { name: "Unapplied artwork", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("applied")).toBeEmpty();
  await page
    .getByRole("button", { name: "Keep recovery draft & close", exact: true })
    .click();
  await page.getByRole("button", { name: "Reopen Studio" }).click();
  await page
    .getByRole("button", { name: "Restore draft", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Text", exact: true }),
  ).toHaveValue("UNAPPLIED DESIGN");
  await page
    .getByRole("button", { name: "Save & use in order", exact: true })
    .click();
  await expect(page.getByTestId("applied")).toContainText("UNAPPLIED DESIGN");
  await expect(
    page.getByRole("button", { name: "Reopen Studio" }),
  ).toBeVisible();
});

test("recovery is isolated for each order and survives a refresh", async ({
  page,
}) => {
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/?embedded&scope=separate-a");
  await page
    .getByRole("textbox", { name: "Text", exact: true })
    .fill("ORDER A ONLY");
  await expect
    .poll(() =>
      page.evaluate(() =>
        sessionStorage.getItem("roccandy-studio-recovery-v2:separate-a"),
      ),
    )
    .toContain("ORDER A ONLY");
  await page.goto("/?embedded&scope=separate-b");
  await expect(
    page.getByRole("button", { name: "Restore draft", exact: true }),
  ).toHaveCount(0);
  await page.goto("/?embedded&scope=separate-a");
  await page
    .getByRole("button", { name: "Restore draft", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Text", exact: true }),
  ).toHaveValue("ORDER A ONLY");
  await page.reload();
  await page
    .getByRole("button", { name: "Restore draft", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Text", exact: true }),
  ).toHaveValue("ORDER A ONLY");
});

test("preserves original image resolution through private upload, native cropped export and portable project", async ({
  page,
}) => {
  const image = await sharp({
    create: { width: 3000, height: 1000, channels: 4, background: "#eb2345" },
  })
    .png()
    .toBuffer();
  await page
    .locator('input[accept="image/png,image/jpeg,image/webp"]')
    .setInputFiles({ name: "label.png", mimeType: "image/png", buffer: image });
  await expect(
    page.getByRole("button", { name: "label.png", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Save & use in order", exact: true })
    .click();
  await expect(page.getByTestId("applied")).toContainText('"imageWidth":3000');
  const saved = JSON.parse(
    (await page.getByTestId("applied").textContent()) || "null",
  );
  const original = await page.request.get(
    `/api/admin/design/assets/${saved.layers[1].image.slice(12)}`,
  );
  expect(Buffer.from(await original.body())).toEqual(image);
  await page.getByLabel("Crop to image layers").check();
  await page.getByLabel("Export resolution").selectOption("native");
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PNG", exact: true }).click();
  const downloaded = await downloading;
  await downloaded.saveAs("test-results/studio-native-label.png");
  const info = await sharp(
    await readFile((await downloaded.path())!),
  ).metadata();
  expect(info.width).toBe(3000);
  expect(info.height).toBe(1000);
  const projectDownload = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download project", exact: true })
    .click();
  const project = JSON.parse(
    await readFile((await (await projectDownload).path())!, "utf8"),
  );
  expect(project.assets[saved.layers[1].image]).toMatch(
    /^data:image\/png;base64,/,
  );
});

test("imports a prototype project with bundled fonts and exports a cropped JPEG",async({page})=>{
  const png=await sharp({create:{width:1000,height:400,channels:4,background:"#aabbcc"}}).png().toBuffer();
  const project={v:1,caption:"Prototype client",jacket:{style:"pin",segments:12,ring:.2,gap:.2,cols:2,colorA:"#ff0000",colorB:"#0000ff",face:"#ffffff",pin:"#00ff00"},layers:[{type:"arc",name:"Curved title",font:"Montserrat",text:"THANK YOU",size:48,radiusF:.72,side:"top",bold:true,x:462,y:470},{type:"image",name:"Client label",img:`data:image/png;base64,${png.toString("base64")}`,scale:.4,x:462,y:470}]};
  await page.locator('input[accept=".json,application/json"]').setInputFiles({name:"client.rcmock.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(project))});
  await expect(page.getByLabel("Design name",{exact:true})).toHaveValue("Prototype client");
  await expect(page.getByLabel("Jacket segments",{exact:true})).toHaveValue("12");
  await page.getByLabel("Crop to image layers").check();await page.getByLabel("Export resolution").selectOption("native");
  const downloading=page.waitForEvent("download");await page.getByRole("button",{name:"Export JPEG",exact:true}).click();
  const download=await downloading;expect(download.suggestedFilename()).toMatch(/\.jpg$/);
  const image=await sharp(await readFile((await download.path())!)).metadata();expect(image.format).toBe("jpeg");expect(image.width).toBe(1000);expect(image.height).toBe(400);
});
