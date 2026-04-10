import * as dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { Pinecone } from '@pinecone-database/pinecone';
import * as schema from '../src/database/schema';

dotenv.config();

/**
 * Script to vectorize all existing products in the database and upsert them to Pinecone.
 * Usage: npx tsx drizzle/vectorize.ts
 */
async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const apiKey = process.env.PINECONE_API_KEY;
  const indexName = process.env.PINECONE_API_INDEX;

  if (!databaseUrl || !apiKey || !indexName) {
    console.error('Missing environment variables (DATABASE_URL, PINECONE_API_KEY, PINECONE_API_INDEX)');
    process.exit(1);
  }

  const client = postgres(databaseUrl);
  const db = drizzle(client, { schema });

  const pc = new Pinecone({ apiKey });
  const index = pc.Index(indexName);

  console.log('🔍 Fetching products from database...');
  const allProducts = await db.query.products.findMany({
    with: {
      brands: true,
      category: true,
      variants: {
        with: {
          attributeValues: {
            with: {
              attribute: true,
              option: true,
            },
          },
        },
      },
      attributeValues: {
        with: {
          attribute: true,
          option: true,
        },
      },
    },
  });

  console.log(`Found ${allProducts.length} products. Starting vectorization...`);

  let totalUpserted = 0;

  for (const product of allProducts) {
    console.log(`Processing product: ${product.name} (ID: ${product.id})`);

    const toUpserts = product.variants.map((variant) => {
      const vectorText = [
        product.name,
        variant.name,
        product.brands?.name ? `Thương hiệu: ${product.brands.name}` : null,
        product.category?.name ? `Danh mục: ${product.category.name}` : null,
        variant.attributeValues.map(a => `${a.attribute.name}: ${a.value || a.option?.value || ''}`).join(', '),
        product.attributeValues.map(a => `${a.attribute.name}: ${a.value || a.option?.value || ''}`).join(', '),
      ].filter(Boolean).join(' | ');

      return {
        id: `${product.id}:${variant.id}`,
        text: vectorText,
        metadata: {
          productId: product.id,
          variantId: variant.id,
          name: variant.name || product.name,
          productName: product.name,
          slug: product.slug,
          categoryId: product.categoryId,
          brandId: product.brands?.id || '',
          price: variant.price,
          salePrice: -1,
          stock: variant.stock,
          sku: variant.sku,
          attributes: vectorText,
          isDeleted: false,
        }
      };
    }).filter(v => v.text.trim().length > 0);

    if (toUpserts.length === 0) {
      console.warn(`No variants found or vector text empty for product: ${product.name}`);
      continue;
    }

    try {
      // 1. Generate Embeddings (using the same model as ProductService)
      const embeddingResult = await pc.inference.embed({
        model: 'multilingual-e5-large',
        inputs: toUpserts.map((item) => item.text),
        parameters: { input_type: 'passage', truncate: 'END' }
      });

      const records = toUpserts.map((item, idx) => {
        const embedding = embeddingResult.data[idx];
        if (!embedding || !('values' in embedding) || !embedding.values) {
          throw new Error(`Failed to generate embedding for record ${item.id}`);
        }
        return {
          id: item.id,
          values: embedding.values,
          metadata: item.metadata
        };
      });

      // 2. Upsert to Pinecone
      await index.upsert({ records });
      totalUpserted += records.length;
      console.log(`Upserted ${records.length} variants for "${product.name}"`);
    } catch (error: any) {
      console.error(`Failed to process product "${product.name}":`, error.message);
    }
  }

  console.log(`\n✨ Vectorization complete! Total records upserted: ${totalUpserted}`);
  await client.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
