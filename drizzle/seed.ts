import * as dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { hash } from 'argon2';
import {
  users,
  categories,
  attribute_groups,
  attributes,
  attribute_options,
  products,
  product_images,
  product_variants,
  variant_images,
  product_attribute_values,
  variant_attribute_values,
} from '../src/database/schema';
import { eq } from 'drizzle-orm';
import * as schema from '../src/database/schema';
dotenv.config();

const ADMIN_EMAIL = 'admin@admin.com';
const ADMIN_PHONE = '0123456789';
const ADMIN_PASSWORD = 'admin123#';

const NORMAL_EMAIL = 'normal@normal.com';
const NORMAL_PHONE = '0363636339';
const NORMAL_PASSWORD = 'normal123#';

async function seed() {
  const client = postgres(process.env.DATABASE_URL!);
  const db = drizzle(client, { schema });

  console.log('🌱 Seeding admin user...');

  //   seed payment methods cod

  await db.insert(users).values({
    email: NORMAL_EMAIL,
    phone: NORMAL_PHONE,
    passwordHash: await hash(NORMAL_PASSWORD),
    role: 'customer',
  });
  return 
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, ADMIN_EMAIL));
  if (existing.length > 0) {
    console.log('⚠️  Admin user already exists, skipping.');
  } else {
    const passwordHash = await hash(ADMIN_PASSWORD);
    await db.insert(users).values({
      email: ADMIN_EMAIL,
      phone: ADMIN_PHONE,
      passwordHash,
      role: 'admin',
    });

    console.log('✅ Admin user created');
    console.log(`   Email:    ${ADMIN_EMAIL}`);
    console.log(`   Password: ${ADMIN_PASSWORD}`);
  }

  console.log('🌱 Seeding categories and products...');

  // Check if category already exists to avoid duplicate seed runs
  const existingCategory = await db
    .select()
    .from(categories)
    .where(eq(categories.slug, 'dien-thoai'));
  if (existingCategory.length > 0) {
    console.log('⚠️  Categories already seeded, skipping catalog seed.');
  } else {
    const electronics = await db
      .insert(categories)
      .values({
        name: 'Điện tử',
        slug: 'dien-tu',
      })
      .returning();

    const smartphones = await db
      .insert(categories)
      .values({
        name: 'Điện thoại',
        slug: 'dien-thoai',
        parentId: electronics[0].id,
      })
      .returning();

    // Attribute Groups
    const specsGroup = await db
      .insert(attribute_groups)
      .values({
        name: 'Thông số kỹ thuật',
        categoryId: smartphones[0].id,
      })
      .returning();

    // Attributes
    const [storageAttr, colorAttr, processorAttr] = await db
      .insert(attributes)
      .values([
        {
          name: 'Dung lượng',
          slug: 'dung-luong',
          type: 'text',
          filterable: true,
          groupId: specsGroup[0].id,
          sortOrder: 1,
        },
        {
          name: 'Màu sắc',
          slug: 'mau-sac',
          type: 'text',
          filterable: true,
          groupId: specsGroup[0].id,
          sortOrder: 2,
        },
        {
          name: 'Vi xử lý',
          slug: 'vi-xu-ly',
          type: 'text',
          filterable: true,
          groupId: specsGroup[0].id,
          sortOrder: 3,
        },
      ])
      .returning();

    // Attribute Options (Expanded for multiple products)
    const [
      storage256,
      storage512,
      storage1TB,
      colorBlack,
      colorDesert,
      colorTitanGray,
      colorTitanBlack,
    ] = await db
      .insert(attribute_options)
      .values([
        { attributeId: storageAttr.id, value: '256GB', slug: '256gb' },
        { attributeId: storageAttr.id, value: '512GB', slug: '512gb' },
        { attributeId: storageAttr.id, value: '1TB', slug: '1tb' }, // New Storage Option

        { attributeId: colorAttr.id, value: 'Titan Đen', slug: 'titan-den' },
        {
          attributeId: colorAttr.id,
          value: 'Titan Sa mạc',
          slug: 'titan-sa-mac',
        },
        { attributeId: colorAttr.id, value: 'Xám Titan', slug: 'xam-titan' }, // New Color Option
        { attributeId: colorAttr.id, value: 'Đen Titan', slug: 'den-titan' }, // New Color Option
      ])
      .returning();

    // ==========================================
    // PRODUCT 1: iPhone 16 Pro Max
    // ==========================================
    const iphone = await db
      .insert(products)
      .values({
        categoryId: smartphones[0].id,
        name: 'iPhone 16 Pro Max',
        slug: 'iphone-16-pro-max',
        description: 'Chiếc iPhone tuyệt đỉnh.',
      })
      .returning();

    await db.insert(product_attribute_values).values({
      productId: iphone[0].id,
      attributeId: processorAttr.id,
      value: 'Apple A18 Pro',
    });

    const [ipMainImage, ipSecondaryImage] = await db
      .insert(product_images)
      .values([
        {
          productId: iphone[0].id,
          url: 'https://cdn.tgdd.vn/Products/Images/42/329149/iphone-16-pro-max-sa-mac-thumb-1-600x600.jpg',
          isMain: true,
          sortOrder: 1,
        },
        {
          productId: iphone[0].id,
          url: 'https://cdn.tgdd.vn/Products/Images/42/329149/iphone-16-pro-max-sa-mac-thumb-1-600x600.jpg',
          isMain: false,
          sortOrder: 2,
        },
      ])
      .returning();

    const [ipVariant1, ipVariant2] = await db
      .insert(product_variants)
      .values([
        {
          productId: iphone[0].id,
          sku: 'IP16PM-256-BLK',
          price: 34990000,
          stock: 100,
          name: 'iPhone 16 Pro Max 256GB Titan Đen',
        },
        {
          productId: iphone[0].id,
          sku: 'IP16PM-512-DST',
          price: 40990000,
          stock: 50,
          name: 'iPhone 16 Pro Max 512GB Titan Sa mạc',
        },
      ])
      .returning();

    await db.insert(variant_images).values([
      { variantId: ipVariant1.id, imageId: ipMainImage.id, isMain: true },
      { variantId: ipVariant2.id, imageId: ipSecondaryImage.id, isMain: true },
    ]);

    await db.insert(variant_attribute_values).values([
      {
        variantId: ipVariant1.id,
        attributeId: storageAttr.id,
        optionId: storage256.id,
      },
      {
        variantId: ipVariant1.id,
        attributeId: colorAttr.id,
        optionId: colorBlack.id,
      },
      {
        variantId: ipVariant2.id,
        attributeId: storageAttr.id,
        optionId: storage512.id,
      },
      {
        variantId: ipVariant2.id,
        attributeId: colorAttr.id,
        optionId: colorDesert.id,
      },
    ]);

    // ==========================================
    // PRODUCT 2: Samsung Galaxy S24 Ultra
    // ==========================================
    const samsung = await db
      .insert(products)
      .values({
        categoryId: smartphones[0].id,
        name: 'Samsung Galaxy S24 Ultra',
        slug: 'samsung-galaxy-s24-ultra',
        description: 'Galaxy AI is here. Kỷ nguyên AI mới.',
      })
      .returning();

    await db.insert(product_attribute_values).values({
      productId: samsung[0].id,
      attributeId: processorAttr.id,
      value: 'Snapdragon 8 Gen 3 for Galaxy',
    });

    const [ssMainImage, ssSecondaryImage] = await db
      .insert(product_images)
      .values([
        {
          productId: samsung[0].id,
          url: 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/s/s/ss-s24-ultra-xam-222.png',
          isMain: true,
          sortOrder: 1,
        },
        {
          productId: samsung[0].id,
          url: 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/s/s/ss-s24-ultra-xam-222.png',
          isMain: false,
          sortOrder: 2,
        },
      ])
      .returning();

    const [ssVariant1, ssVariant2] = await db
      .insert(product_variants)
      .values([
        {
          productId: samsung[0].id,
          sku: 'SGS24U-256-GRY',
          price: 33990000,
          stock: 80,
          name: 'Samsung Galaxy S24 Ultra 256GB Xám Titan',
        },
        {
          productId: samsung[0].id,
          sku: 'SGS24U-1TB-BLK',
          price: 44990000,
          stock: 30,
          name: 'Samsung Galaxy S24 Ultra 1TB Đen Titan',
        },
      ])
      .returning();

    await db.insert(variant_images).values([
      { variantId: ssVariant1.id, imageId: ssMainImage.id, isMain: true },
      { variantId: ssVariant2.id, imageId: ssSecondaryImage.id, isMain: true },
    ]);

    await db.insert(variant_attribute_values).values([
      {
        variantId: ssVariant1.id,
        attributeId: storageAttr.id,
        optionId: storage256.id,
      }, // Re-using 256GB option
      {
        variantId: ssVariant1.id,
        attributeId: colorAttr.id,
        optionId: colorTitanGray.id,
      },
      {
        variantId: ssVariant2.id,
        attributeId: storageAttr.id,
        optionId: storage1TB.id,
      },
      {
        variantId: ssVariant2.id,
        attributeId: colorAttr.id,
        optionId: colorTitanBlack.id,
      },
    ]);

    console.log('✅ Categories and Products seeded successfully.');
  }

  await client.end();
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
