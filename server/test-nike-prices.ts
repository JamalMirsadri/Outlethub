import { nikeOutletConnector } from "./src/modules/scrapers/connectors/nike/nike-outlet.connector.js";

async function test() {
  const context = {
    runId: "test-run",
    source: {
      id: "test-source",
      name: "Nike Outlet",
      website: "https://www.nike.com/w/sale-3yaep",
      connectorKey: "nike-outlet",
    }
  };

  await nikeOutletConnector.initialize(context as any);
  
  try {
    const rawProducts = await nikeOutletConnector.run(context as any);
    const normalized = await nikeOutletConnector.normalize(rawProducts, context as any);
    
    for (const p of normalized) {
      console.log(p.name, p.price, p.oldPrice, p.discountPercent);
    }
  } catch (e) {
    console.error(e);
  }
}

test();