import { loadEnvConfig } from "@next/env";
import { Client } from "pg";
import { writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { designFromOrder, nameDesignForOrder, newDesignLayer } from "../src/lib/candyDesign";
import { resolveSiteDesignerDefaults } from "../src/lib/siteDesignerDefaults";
import { importLegacyCandyImage } from "../src/lib/candyDesignImport";

loadEnvConfig(process.cwd());
async function main() {
  const apply=process.argv.includes('--apply');
  const db=new Client({connectionString:process.env.SUPABASE_POOLER_CONNECTION||process.env.DATABASE_URL||process.env.POSTGRES_URL,ssl:{rejectUnauthorized:false}});
  await db.connect();
  try {
    const {rows:orders}=await db.query("select * from public.orders where design_type is distinct from 'premade' and (nullif(btrim(design_text),'') is not null or nullif(btrim(logo_url),'') is not null or candy_design is not null) order by created_at,id");
    const before=createHash('sha256').update(JSON.stringify(orders)).digest('hex');
    const palette=(await db.query('select category,shade,hex from public.color_palette')).rows;
    const defaults=resolveSiteDesignerDefaults(palette);
    const origins=[process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SITE_URL,process.env.SITE_URL,'https://roccandy.com.au','https://www.roccandy.com.au'].filter(Boolean).map(v=>new URL(v!).origin);
    const report={mode:apply?'apply':'dry-run',eligible:orders.length,imported:0,alreadyImported:0,failed:[] as Array<{orderNumber:string;error:string}>,ordersUnchanged:true};
    if(!apply) { console.log(JSON.stringify(report)); return; }
    const {persistDesignAssets}=await import('../src/lib/candyDesignExport');
    for(const order of orders) {
      try {
        const existing=await db.query('select id from public.candy_designs where source_order_id=$1',[order.id]);
        if(existing.rowCount) { report.alreadyImported++; continue; }
        const design=nameDesignForOrder(designFromOrder(order,defaults),order.title);
        if(!order.candy_design && order.logo_url) {
          const image=await importLegacyCandyImage(order.logo_url,origins);
          design.layers=[{...newDesignLayer('image','artwork',defaults),name:'Original order artwork',image}];
        }
        const document=await persistDesignAssets(design); delete document.source;
        await db.query('select public.import_order_candy_design($1,$2)',[order.id,document]);
        report.imported++;
        if((report.imported+report.failed.length)%20===0) console.log(JSON.stringify({processed:report.imported+report.alreadyImported+report.failed.length,total:orders.length}));
      } catch(error) { report.failed.push({orderNumber:order.order_number || order.id,error:error instanceof Error?error.message:'Import failed'}); }
    }
    const after=(await db.query("select * from public.orders where id=any($1::uuid[]) order by created_at,id",[orders.map(o=>o.id)])).rows;
    report.ordersUnchanged=before===createHash('sha256').update(JSON.stringify(after)).digest('hex');
    await writeFile('/tmp/roccandy-order-design-backfill.json',JSON.stringify(report,null,2));
    console.log(JSON.stringify(report));
    if(report.failed.length || !report.ordersUnchanged) process.exitCode=1;
  } finally {await db.end();}
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Backfill failed');process.exitCode=1;});
