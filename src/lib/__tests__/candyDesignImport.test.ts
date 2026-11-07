import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { importLegacyCandyImage } from "../candyDesignImport";

describe("historical artwork import",()=>{
  it("extracts the PNG from a bounded ICO directory and produces a supported raster",async()=>{
    const png=await sharp({create:{width:4,height:4,channels:4,background:"#ff0000"}}).png().toBuffer();
    const header=Buffer.alloc(22);header.writeUInt16LE(1,2);header.writeUInt16LE(1,4);header[6]=4;header[7]=4;header.writeUInt16LE(1,10);header.writeUInt16LE(32,12);header.writeUInt32LE(png.length,14);header.writeUInt32LE(22,18);
    const result=await importLegacyCandyImage(`data:image/x-icon;base64,${Buffer.concat([header,png]).toString("base64")}`,[]);
    expect(result).toMatch(/^data:image\/webp;base64,/);
    const metadata=await sharp(Buffer.from(result.split(",")[1],"base64")).metadata();expect(metadata.width).toBe(4);
  });
  it("rejects malformed icon directories without reading outside the container",async()=>{
    const header=Buffer.alloc(6);header.writeUInt16LE(1,2);header.writeUInt16LE(500,4);
    await expect(importLegacyCandyImage(`data:image/x-icon;base64,${header.toString("base64")}`,[])).rejects.toThrow("Invalid icon");
  });
  it("checks redirect destinations against the approved origins before fetching again",async()=>{
    const fetch=vi.fn().mockResolvedValue(new Response(null,{status:302,headers:{Location:"https://unapproved.test/secret"}}));
    vi.stubGlobal("fetch",fetch);
    try {await expect(importLegacyCandyImage("https://artwork.test/logo.png",["https://artwork.test"])).rejects.toThrow("not approved");expect(fetch).toHaveBeenCalledTimes(1);}
    finally {vi.unstubAllGlobals();}
  });
});
