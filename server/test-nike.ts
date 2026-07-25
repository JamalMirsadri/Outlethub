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
  console.log("Initialized");
  
  try {
    const rawProducts = await nikeOutletConnector.run(context as any);
    console.log(`Found ${rawProducts.length} raw products`);
    
    const normalized = await nikeOutletConnector.normalize(rawProducts, context as any);
    console.log(`Normalized ${normalized.length} products`);
    console.log(normalized[0]);
  } catch (e) {
    console.error(e);
  }
}

test();