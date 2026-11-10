import { test, expect, type Page, type FrameLocator } from "@playwright/test";
import sharp from "sharp";
import { readFile } from "node:fs/promises";
const errors = new WeakMap<Page, string[]>();
const studio = (page: Page) =>
  page.frameLocator('iframe[title="Roc Candy Mockup Studio"]');
async function ready(page: Page, url = "/") {
  await page.goto(url);
  await expect(studio(page).getByLabel("Layer text")).toBeVisible();
  await expect(studio(page).locator("#canonical svg path")).not.toHaveCount(0);
}
async function range(ui: FrameLocator, selector: string, value: string) {
  await ui.locator(selector).evaluate((e, v) => {
    (e as HTMLInputElement).value = v;
    e.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
}
async function apply(page: Page) {
  await studio(page).locator("#useOrder").click();
  await expect(page.getByTestId("applied")).not.toBeEmpty();
  return JSON.parse((await page.getByTestId("applied").textContent())!);
}
async function label(page: Page, width = 800, height = 240) {
  const bytes = await sharp({
    create: { width, height, channels: 4, background: "#e63946" },
  })
    .png()
    .toBuffer();
  await studio(page)
    .locator("#fileIn")
    .setInputFiles({
      name: "Native label.png",
      mimeType: "image/png",
      buffer: bytes,
    });
  await expect(studio(page).locator(".layer .nm").first()).toContainText(
    "Native label",
  );
  return bytes;
}
test.beforeEach(async ({ page }) => {
  const list: string[] = [];
  errors.set(page, list);
  page.on("pageerror", (e) => list.push(e.message));
  await ready(page);
});
test.afterEach(async ({ page }) => {
  expect(errors.get(page)).toEqual([]);
});

test("matches supplied tool rail, stage, collapsible settings and inline layers", async ({
  page,
}) => {
  const ui = studio(page);
  await expect(ui.getByRole("navigation", { name: "Tools" })).toBeVisible();
  for (const tool of [
    "Move",
    "Box select",
    "Lasso",
    "Remove colour",
    "Eyedropper",
    "Paint brush",
    "Recolour image",
    "Eraser",
    "Magic select",
    "Text",
    "Curve top",
    "Curve bottom",
    "Heart",
    "Images",
  ])
    await expect(
      ui.locator(".rail").getByRole("button", { name: tool, exact: true }),
    ).toBeVisible();
  await expect(ui.locator(".side h2")).toHaveText([
    "Whole design Reset",
    "Export",
    "Jacket ",
    "Colours",
    "Layers Duplicate",
    "Production & proofs",
  ]);
  const rail = (await ui.locator(".rail").boundingBox())!,
    stage = (await ui.locator(".stage").boundingBox())!,
    side = (await ui.locator(".side").boundingBox())!;
  expect(rail.width).toBeLessThan(90);
  expect(rail.x + rail.width).toBeLessThanOrEqual(stage.x);
  expect(side.x).toBeGreaterThan(stage.x + stage.width - 1);
  await expect(ui.locator(".layer.on .props")).toBeVisible();
  await expect(ui.getByText("Selected layer", { exact: true })).toHaveCount(1); // colour target, never a duplicate editor panel
  await ui.getByRole("button", { name: "Export", exact: true }).click();
  await expect(ui.locator("#expFmt")).toBeHidden();
  await ui.getByRole("button", { name: "Export", exact: true }).click();
  await page.screenshot({
    path: "test-results/studio-admin-experience.png",
    fullPage: true,
  });
});
test("saves complete lettering, curved layers, complex jackets and their colour specifications", async ({
  page,
}) => {
  const ui = studio(page);
  await ui.getByLabel("Layer text").fill("THANK YOU KARRI");
  await ui.locator("#jStyle").selectOption("pin");
  await ui.locator("#jSeg").selectOption("12");
  await range(ui, "#jRing", ".25");
  await range(ui, "#jGap", ".30");
  await ui.locator("#jCols").selectOption("3");
  await ui.locator("[data-add=arctop]").click();
  await ui.getByLabel("Layer text").fill("TOP NAME");
  await ui.getByLabel("Font", { exact: true }).selectOption("Montserrat");
  const saved = await apply(page);
  expect(saved.layers[0].text).toBe("THANK YOU KARRI");
  expect(saved.layers[1]).toMatchObject({
    text: "TOP NAME",
    font: "montserrat",
    curve: "up",
  });
  expect(saved.jacket.advanced).toMatchObject({
    segments: 12,
    ring: 0.25,
    gap: 0.3,
  });
  expect(saved.jacket.colours).toHaveLength(3);
  await expect(ui.locator("#productionSpec")).toContainText(
    "clockwise from 12",
  );
  await expect(ui.locator("#canonical [data-advanced-jacket]")).toHaveAttribute(
    "data-advanced-jacket",
    "12",
  );
});
test("colour targets, custom swatches, background, design size and presentation are integrated", async ({
  page,
}) => {
  const ui = studio(page);
  await ui.getByRole("button", { name: "Background", exact: true }).click();
  await ui.getByRole("textbox", { name: "Hex colour code" }).fill("#aabbcc");
  await ui.locator("#addSwatch").click();
  await range(ui, "#zoom", "80");
  await range(ui, "#boxsize", "70");
  await ui.locator("#present").click();
  await expect(ui.locator(".rail")).toBeHidden();
  await expect(ui.locator(".side")).toBeHidden();
  await expect(ui.locator("#presentCap")).toHaveText("Studio fixture");
  await ui.locator("#present").click();
  const saved = await apply(page);
  expect(saved.presentation).toMatchObject({
    background: "#aabbcc",
    designScale: 0.8,
  });
  await expect(ui.locator("[data-studio-scene]")).toHaveAttribute(
    "transform",
    /scale\(0.8\)/,
  );
});
test("edits image pixels on the stage with selections, splits, eraser and undo", async ({
  page,
}) => {
  const ui = studio(page);
  await label(page);
  await ui.locator("[data-tool=magic]").click();
  const box = (await ui.locator("#ov").boundingBox())!;
  // Image is centred on the face, at (545,660) in the application's scene.
  await ui
    .locator("#ov")
    .click({
      position: { x: (545 / 1772) * box.width, y: (660 / 1300) * box.height },
    });
  await expect(ui.locator("#maskActs")).toBeVisible();
  await ui.locator("#maskCopy").click();
  await expect(ui.locator(".layer")).toHaveCount(3);
  await ui.locator("#undo").click();
  await expect(ui.locator(".layer")).toHaveCount(2);
  await ui.locator("[data-tool=erase]").click();
  await ui
    .locator("#ov")
    .click({
      position: { x: (545 / 1772) * box.width, y: (660 / 1300) * box.height },
    });
  const saved = await apply(page);
  expect(saved.layers).toHaveLength(2);
  expect(saved.layers[1].image).toMatch(/^candy-asset:/);
  await expect(
    page.getByRole("dialog", { name: "Edit artwork pixels" }),
  ).toHaveCount(0);
});
test("paints the actual shared jacket, exports it, and can undo the stroke", async ({
  page,
}) => {
  const ui = studio(page);
  await ui.locator("[data-tool=brush]").click();
  const box = (await ui.locator("#ov").boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.51, box.y + box.height * 0.4);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.45, {
    steps: 5,
  });
  await page.mouse.up();
  await expect(ui.locator(".layer")).toHaveCount(2);
  const saved = await apply(page);
  expect(saved.layers[0]).toMatchObject({ surface: "jacket", frame: "scene" });
  expect(saved.layers[0].image).toMatch(/^candy-asset:/);
  const download = page.waitForEvent("download");
  await ui.locator("#export").click();
  const file = await download;
  expect((await readFile((await file.path())!)).length).toBeGreaterThan(1000);
  await ui.locator("#undo").click();
  await expect(ui.locator(".layer")).toHaveCount(1);
});
test("native uploads, blank-label editing and cropped JPEG/project round trips preserve resolution", async ({
  page,
}) => {
  const ui = studio(page);
  await label(page, 3000, 1000);
  await ui.locator("#jEye").click();
  await expect(ui.locator("#canonical [data-advanced-jacket]")).toHaveCount(0);
  await ui.locator("#expCrop").check();
  await ui.locator("#expFmt").selectOption("jpeg");
  const download = page.waitForEvent("download");
  await ui.locator("#export").click();
  const file = await download;
  const metadata = await sharp(await readFile((await file.path())!)).metadata();
  expect(metadata).toMatchObject({ format: "jpeg", width: 3000, height: 1000 });
  const projectDownload = page.waitForEvent("download");
  await ui.locator("#saveProj").click();
  const project = await readFile((await (await projectDownload).path())!);
  const parsed = JSON.parse(project.toString());
  expect(parsed.design.presentation.hideCandy).toBe(true);
  expect(Object.keys(parsed.assets)).toHaveLength(1);
  await ui
    .locator("#projIn")
    .setInputFiles({
      name: "portable.json",
      mimeType: "application/json",
      buffer: project,
    });
  await expect(ui.locator(".layer")).toHaveCount(2);
  const saved = await apply(page);
  expect(saved.layers[1]).toMatchObject({
    imageWidth: 3000,
    imageHeight: 1000,
  });
});
test("library save cannot silently discard unapplied artwork and recovery survives closing", async ({
  page,
}) => {
  await ready(page, "/?embedded&scope=order-a");
  const ui = studio(page);
  await ui.getByLabel("Layer text").fill("KEEP THIS ARTWORK");
  await ui.locator("#saveLibrary").click();
  await expect(ui.locator("#integrationStatus")).toContainText(
    "Saved to library",
  );
  expect((await ui.locator('.stage').boundingBox())!.height).toBeGreaterThan(300);
  await ui.locator("#closeStudio").click();
  await expect(
    page.getByRole("group", { name: "Unapplied artwork" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Keep recovery draft & close" })
    .click();
  await page.getByRole("button", { name: "Reopen Studio" }).click();
  await page
    .getByRole("button", { name: "Restore draft", exact: true })
    .click();
  await expect(studio(page).getByLabel("Layer text")).toHaveValue(
    "KEEP THIS ARTWORK",
  );
});
test("scopes recovery by order and preserves original documents when opened", async ({
  page,
}) => {
  const ui = studio(page);
  await expect(ui.locator("#integrationStatus")).toHaveText("");
  await ready(page, "/?scope=order-a");
  await studio(page).getByLabel("Layer text").fill("ORDER A");
  await page.waitForTimeout(900);
  await ready(page, "/?scope=order-b");
  await expect(page.getByRole("button", { name: "Restore draft" })).toHaveCount(
    0,
  );
  await ready(page, "/?scope=order-a");
  await page.getByRole("button", { name: "Restore draft" }).click();
  await expect(studio(page).getByLabel("Layer text")).toHaveValue("ORDER A");
});
test("retains legacy geometry and supports a narrow workspace", async ({
  page,
}) => {
  await ready(page, "/?legacy");
  await expect(studio(page).locator("#jStyle")).toHaveValue("legacy");
  await expect(
    studio(page).locator("#canonical [data-advanced-jacket]"),
  ).toHaveCount(0);
  const saved = await apply(page);
  expect(saved.schemaVersion).toBe(1);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(studio(page).locator("[data-add=text]")).toBeVisible();
  await studio(page).locator("[data-add=text]").click();
  await expect(studio(page).getByLabel("Layer text")).toHaveValue("NAME");
  await page.screenshot({
    path: "test-results/studio-admin-mobile.png",
    fullPage: true,
  });
});
test('shows lettering service failures inside the canvas instead of concealing the warning',async({page})=>{
  await page.route('**/api/admin/design/text',route=>route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({error:'Lettering service temporarily unavailable'})}));
  await studio(page).getByLabel('Layer text').fill('VISIBLE SERVICE FAILURE');
  await expect(studio(page).getByRole('alert')).toBeVisible();
  await expect(studio(page).getByRole('alert')).toContainText('Lettering service temporarily unavailable');
});

test("opens data-only prototype projects into the shared renderer", async ({
  page,
}) => {
  const ui = studio(page);
  const project = {
    v: 1,
    caption: "Imported prototype",
    jacket: {
      style: "pin",
      segments: 6,
      cols: 3,
      ring: 0.2,
      gap: 0.15,
      colorA: "#ff0000",
      colorB: "#00ff00",
      colorC: "#0000ff",
      face: "#ffffff",
      pin: "#ffffff",
    },
    layers: [
      {
        id: 1,
        type: "arc",
        name: "Top",
        text: "THANK YOU KARRI",
        font: "Montserrat",
        size: 45,
        x: 462,
        y: 470,
        radiusF: 0.72,
        side: "top",
        visible: true,
        opacity: 1,
        clip: true,
      },
    ],
  };
  await ui
    .locator("#projIn")
    .setInputFiles({
      name: "original.rcmock.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(project)),
    });
  await expect(ui.getByLabel("Layer text")).toHaveValue("THANK YOU KARRI");
  const saved = await apply(page);
  expect(saved.jacket.advanced.segments).toBe(6);
  expect(saved.layers[0].curve).toBe("up");
});
