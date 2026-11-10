import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { DESIGN_FONTS, newDesignLayer, studioCandyDesign, parseCandyDesign } from "@/lib/candyDesign";
import { encodeStudioRecovery, readStudioRecovery, studioRecoveryKey } from "@/lib/designStudioRecovery";
import { parseStudioProject } from "@/lib/studioProject";
import { importPrototypeProject } from "@/lib/studioPrototypeImport";
import { candyTextGeometry } from "@/lib/candyDesignText";
import { parseTextGeometry, studioTextWarnings } from "@/lib/candyTextGeometry";
import { storeDesignImage } from "@/lib/candyDesignAssets";
import { designExportSize } from "@/lib/designImageBounds";
const { images } = vi.hoisted(()=>({ images:new Map<string,Buffer>() }));
vi.mock("@/lib/supabase/admin",()=>({supabaseAdminClient:{storage:{from:()=>({upload:async(key:string,bytes:Buffer)=>{images.set(key,Buffer.from(bytes));return{error:null};}})}}}));
describe("Studio recovery and portable native artwork",()=>{
  beforeEach(()=>images.clear());
  it("keeps recovery separate per order and detaches changed source revisions",()=>{
    const baseline=studioCandyDesign("Order A"),edited=structuredClone(baseline);edited.layers[0].text="KEEP ME";edited.source={id:"77777777-7777-4777-8777-777777777777",revision:2};
    expect(studioRecoveryKey("order-a")).not.toBe(studioRecoveryKey("order-b"));
    const raw=encodeStudioRecovery(edited,baseline);expect(readStudioRecovery(raw,baseline)?.design.source?.revision).toBe(2);
    const changed=structuredClone(baseline);changed.name="Updated original";
    expect(readStudioRecovery(raw,changed)).toMatchObject({changedSource:true,design:{layers:[{text:"KEEP ME"}]}});expect(readStudioRecovery(raw,changed)?.design.source).toBeUndefined();
    expect(readStudioRecovery("broken",baseline)).toBeNull();
  });
  it("round trips an embedded PNG exceeding the old inline limit through a portable asset envelope",async()=>{
    const data=Buffer.alloc(1000*1000*3);let seed=17;for(let i=0;i<data.length;i++){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;data[i]=seed&255;}
    const png=await sharp(data,{raw:{width:1000,height:1000,channels:3}}).png().toBuffer();expect(png.length).toBeGreaterThan(2_000_000);
    const asset=await storeDesignImage(png);expect(images.get(asset.image.slice(12))).toEqual(png);
    const design=studioCandyDesign();design.layers=[{...newDesignLayer("image","large"),...asset}];
    const project=parseStudioProject({format:"roccandy-studio",version:1,design,assets:{[asset.image]:`data:image/png;base64,${png.toString("base64")}`}});
    expect(project.design.layers[0].image).toBe(asset.image);expect(project.assets[asset.image]).toHaveLength(22+Math.ceil(png.length/3)*4);
  });
  it("preserves source pixels, identifies native cropped output and rejects executable image formats",async()=>{
    const jpeg=await sharp({create:{width:3200,height:800,channels:3,background:"#aabbcc"}}).jpeg().toBuffer(),asset=await storeDesignImage(jpeg);
    expect(asset.image).toMatch(/\.jpg$/);expect(images.get(asset.image.slice(12))).toEqual(jpeg);
    const design=studioCandyDesign();design.layers=[{...newDesignLayer("image","label"),...asset}];
    expect(designExportSize(design,{cropImages:true,resolution:"native"})).toMatchObject({width:3200,height:800});
    await expect(storeDesignImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).rejects.toThrow();
    expect(()=>parseStudioProject({format:"roccandy-studio",version:1,design,assets:{}})).toThrow("missing");
  });
  it.each(Object.keys(DESIGN_FONTS) as (keyof typeof DESIGN_FONTS)[])("uses portable server/browser geometry for bundled %s",async(font)=>{
    const design=studioCandyDesign();design.layers[0]={...design.layers[0],font,text:"THANK YOU KARRI",italic:true,curve:"up"};
    const geometry=await candyTextGeometry(design);expect(parseTextGeometry(geometry)).toEqual(geometry);expect(geometry.layers["text-1"].glyphs.length).toBeGreaterThan(5);
    design.layers[0].size=200;const large=await candyTextGeometry(design);expect(studioTextWarnings(design,large).length).toBeGreaterThan(0);
    expect(parseCandyDesign({...design,textGeometry:large})?.textGeometry).toEqual(large);
  });
  it("imports prototype jackets, editable arcs and embedded images without executing URLs",async()=>{
    const png=await sharp({create:{width:800,height:200,channels:4,background:"#ff0000"}}).png().toBuffer();
    const result=await importPrototypeProject({v:1,caption:"Imported",jacket:{style:"pin",segments:12,cols:3,colorA:"#ff0000",colorB:"#00ff00",colorC:"#0000ff",ring:.2,gap:.15,face:"#ffffff",pin:"#000000"},layers:[{type:"arc",name:"Top",font:"Montserrat",text:"THANK YOU",size:50,radiusF:.72,side:"top",x:462,y:470},{type:"image",name:"Label",img:`data:image/png;base64,${png.toString("base64")}`,scale:.3,x:462,y:470}]},async image=>storeDesignImage(Buffer.from(image.split(",")[1],"base64")));
    expect(result.design.jacket).toMatchObject({showPinstripe:true,advanced:{segments:12},colours:["#ff0000","#00ff00","#0000ff"]});
    expect(result.design.layers[0]).toMatchObject({font:"montserrat",curve:"up",x:50,y:50});expect(result.design.layers[1].imageWidth).toBe(800);
    await expect(importPrototypeProject({v:1,jacket:{},layers:[{type:"image",img:"https://outside.test/private.png"}]},vi.fn())).rejects.toThrow("embedded");
  });
});
