import { NikeOutletConnector } from "./src/modules/scrapers/connectors/nike/nike-outlet.connector.js";
import fs from "node:fs";

async function test() {
  try {
    const html = fs.readFileSync(".local-services/scraper-artifacts/cmqta77we001kuotc7ofgqlkv/raw-products.json", "utf8");
    const products = JSON.parse(html);
    
    const connector = new NikeOutletConnector();
    
    const context = {
      runId: "test-run",
      source: {
        id: "test-source",
        name: "Nike Outlet",
        website: "https://www.nike.com/w/sale-3yaep",
        connectorKey: "nike-outlet",
      }
    };
    
    const normalized = await connector.normalize(products, context as any);
    
    const badProducts = normalized.filter((p: any) => p.name.includes("Nike Victory") || p.name.includes("Jordan Brooklyn Fleece"));
    console.log("Bad Products:", JSON.stringify(badProducts, null, 2));
  } catch (e) {
    console.error(e);
  }
}

test();