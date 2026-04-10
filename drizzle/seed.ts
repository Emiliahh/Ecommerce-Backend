import * as dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { hash } from 'argon2';
import {
  users,
  brands,
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

// ─────────────────────────────────────────────
//  ACCOUNTS
// ─────────────────────────────────────────────
const ADMIN_EMAIL = 'admin@admin.com';
const ADMIN_PHONE = '0123456789';
const ADMIN_PASSWORD = 'admin123#';

const NORMAL_EMAIL = 'normal@normal.com';
const NORMAL_PHONE = '0363636339';
const NORMAL_PASSWORD = 'normal123#';

// ─────────────────────────────────────────────
//  IMAGE URLS  (CDN / public product photos)
// ─────────────────────────────────────────────
const IMG = {
  // Apple
  ip16pm_desert:
    'https://uscom.com.vn/wp-content/uploads/2024/09/iPhone-16-Pro-Max-Sa-Mac.jpg',
  ip15_black:
    'https://product.hstatic.net/200000409445/product/15-hong-1_914804ff98ee4b47ac5906151c570a29_grande.jpg',
  ipad_pro:
    'https://apple.ngocnguyen.vn/cdn/images/202406/goods_img/new-100-ipad-pro-11-inch-2024-m4-wifi-G15580-1717213633076.png',
  macbook_air:
    'https://cdn.hstatic.net/products/200000409445/5_c7b229d5c668445cbfa426ed88c5c7ca_grande.gif',
  airpods_pro:
    'https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/a/p/apple-airpods-4-thumb.png',

  // Samsung
  s24_ultra_gray:
    'https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/s/s/ss-s24-ultra-xam-222_3_1_1_1.png',
  s24_ultra_black:
    'https://cdn2.cellphones.com.vn/358x/media/catalog/product/3/3/334_5_.png',
  tab_s9:
    'https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/s/a/samsung-galaxy-tab-s9-fe-mint-13_1.jpg',
  galaxy_buds:
    'https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/s/a/samsung_buds4_17_.png',

  // Xiaomi
  mi14_black:
    'https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/x/i/xiaomi-14_2__1_2_1.png',
  mi14_white:
    'https://cdn2.cellphones.com.vn/358x/media/catalog/product/d/i/dien-thoai-nubia-v60-design-6gb-256gb_16_.png',

  // OPPO
  find_x7_black:
    'https://cdn.mobilecity.vn/mobilecity-vn/images/2025/03/oppo-find-x7-trang-cu.jpg.webp',
  reno_11_blue:
    'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/o/p/oppo-reno14-w.jpg',

  // Laptops
  dell_xps:
    'https://laptops.vn/wp-content/uploads/2024/06/Dell-XPS-15-9530.jpg',
  asus_rog:
    'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/a/s/asusus_2.png',

  // Accessories
  logitech_mx:
    'https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/g/r/group_659_40.png',
  samsung_monitor:
    'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/m/h/mhhhb_1_.png',
};

// ─────────────────────────────────────────────
//  MAIN
// ─────────────────────────────────────────────
async function seed() {
  const client = postgres(process.env.DATABASE_URL!);
  const db = drizzle(client, { schema });

  // ── 1. USERS ──────────────────────────────
  console.log('🌱 Seeding users...');
  const existingAdmin = await db
    .select()
    .from(users)
    .where(eq(users.email, ADMIN_EMAIL));

  if (existingAdmin.length === 0) {
    await db.insert(users).values([
      {
        email: ADMIN_EMAIL,
        phone: ADMIN_PHONE,
        passwordHash: await hash(ADMIN_PASSWORD),
        role: 'admin',
        name: 'Admin',
      },
      {
        email: NORMAL_EMAIL,
        phone: NORMAL_PHONE,
        passwordHash: await hash(NORMAL_PASSWORD),
        role: 'customer',
        name: 'Người dùng thường',
      },
    ]);
    console.log('✅ Users created');
  } else {
    console.log('⚠️  Users already exist, skipping.');
  }

  // ── 2. CHECK ALREADY SEEDED ───────────────
  const existingCat = await db
    .select()
    .from(categories)
    .where(eq(categories.slug, 'dien-thoai-apple'));
  if (existingCat.length > 0) {
    console.log('⚠️  Catalog already seeded, skipping.');
    await client.end();
    return;
  }

  // ── 3. BRANDS ─────────────────────────────
  console.log('🌱 Seeding brands...');
  const [apple, samsung, xiaomi, oppo, dell, asus, logitech] = await db
    .insert(brands)
    .values([
      {
        name: 'Apple',
        slug: 'apple',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg',
        description: 'Think Different.',
      },
      {
        name: 'Samsung',
        slug: 'samsung',
        logo: 'https://images.samsung.com/is/image/samsung/assets/vn/about-us/brand/logo/mo/360_197_1.png?$720_N_PNG$',
        description: 'Inspire the World, Create the Future.',
      },
      {
        name: 'Xiaomi',
        slug: 'xiaomi',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/2/29/Xiaomi_logo.svg',
        description: 'Innovation for Everyone.',
      },
      {
        name: 'OPPO',
        slug: 'oppo',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0a/OPPO_LOGO_2019.svg/1920px-OPPO_LOGO_2019.svg.png',
        description: 'Inspiration Ahead.',
      },
      {
        name: 'Dell',
        slug: 'dell',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/1/18/Dell_logo_2016.svg',
        description: 'The Power to Do More.',
      },
      {
        name: 'ASUS',
        slug: 'asus',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/2/2e/ASUS_Logo.svg',
        description: 'In Search of Incredible.',
      },
      {
        name: 'Logitech',
        slug: 'logitech',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/a/a9/Logitech_logo.png',
        description: 'Designed for Extraordinary.',
      },
    ])
    .returning();

  // ── 4. CATEGORIES (hierarchy) ─────────────
  console.log('🌱 Seeding categories...');

  // Level-0 roots
  const [catDienThoai, catMayTinh, catPhuKien] = await db
    .insert(categories)
    .values([
      { name: 'Điện thoại', slug: 'dien-thoai', level: 0 },
      { name: 'Máy tính', slug: 'may-tinh', level: 0 },
      { name: 'Phụ kiện', slug: 'phu-kien', level: 0 },
    ])
    .returning();

  // Level-1 children  (10 leaf categories total)
  const [
    catApplePhone,   // 1
    catSamsungPhone, // 2
    catXiaomiPhone,  // 3
    catOppoPhone,    // 4
    catAppleTablet,  // 5
    catSamsungTablet,// 6
    catLaptopGaming, // 7
    catLaptopVanPhong,// 8
    catTaiNghe,      // 9
    catChuotBanPhim, // 10
  ] = await db
    .insert(categories)
    .values([
      { name: 'Điện thoại Apple', slug: 'dien-thoai-apple', parentId: catDienThoai.id, level: 1 },
      { name: 'Điện thoại Samsung', slug: 'dien-thoai-samsung', parentId: catDienThoai.id, level: 1 },
      { name: 'Điện thoại Xiaomi', slug: 'dien-thoai-xiaomi', parentId: catDienThoai.id, level: 1 },
      { name: 'Điện thoại OPPO', slug: 'dien-thoai-oppo', parentId: catDienThoai.id, level: 1 },
      { name: 'Máy tính bảng Apple', slug: 'may-tinh-bang-apple', parentId: catMayTinh.id, level: 1 },
      { name: 'Máy tính bảng Samsung', slug: 'may-tinh-bang-samsung', parentId: catMayTinh.id, level: 1 },
      { name: 'Laptop Gaming', slug: 'laptop-gaming', parentId: catMayTinh.id, level: 1 },
      { name: 'Laptop Văn phòng', slug: 'laptop-van-phong', parentId: catMayTinh.id, level: 1 },
      { name: 'Tai nghe', slug: 'tai-nghe', parentId: catPhuKien.id, level: 1 },
      { name: 'Chuột & Bàn phím', slug: 'chuot-ban-phim', parentId: catPhuKien.id, level: 1 },
    ])
    .returning();

  // ── 5. ATTRIBUTE GROUPS ────────────────────
  console.log('🌱 Seeding attribute groups...');

  const [
    phoneSpecsGroup,
    laptopSpecsGroup,
    tabletSpecsGroup,
    accessorySpecsGroup,
  ] = await db
    .insert(attribute_groups)
    .values([
      { name: 'Thông số điện thoại', categoryId: catApplePhone.id },
      { name: 'Thông số laptop', categoryId: catLaptopGaming.id },
      { name: 'Thông số máy tính bảng', categoryId: catAppleTablet.id },
      { name: 'Thông số phụ kiện', categoryId: catTaiNghe.id },
    ])
    .returning();

  // ── 6. ATTRIBUTES ─────────────────────────
  console.log('🌱 Seeding attributes...');

  // Phone attributes
  const [
    phoneStorage,
    phoneColor,
    phoneProcessor,
    phoneRam,
  ] = await db
    .insert(attributes)
    .values([
      { name: 'Dung lượng', slug: 'dung-luong', type: 'text', filterable: true, isVariant: true, groupId: phoneSpecsGroup.id, sortOrder: 1 },
      { name: 'Màu sắc', slug: 'mau-sac', type: 'text', filterable: true, isVariant: true, groupId: phoneSpecsGroup.id, sortOrder: 2 },
      { name: 'Vi xử lý', slug: 'vi-xu-ly', type: 'text', filterable: true, isVariant: false, groupId: phoneSpecsGroup.id, sortOrder: 3 },
      { name: 'RAM', slug: 'ram', type: 'text', filterable: true, isVariant: false, groupId: phoneSpecsGroup.id, sortOrder: 4 },
    ])
    .returning();

  // Laptop attributes
  const [
    laptopStorage,
    laptopColor,
    laptopProcessor,
    laptopRam,
  ] = await db
    .insert(attributes)
    .values([
      { name: 'Dung lượng SSD', slug: 'dung-luong', type: 'text', filterable: true, isVariant: true, groupId: laptopSpecsGroup.id, sortOrder: 1 },
      { name: 'Màu sắc', slug: 'mau-sac', type: 'text', filterable: true, isVariant: true, groupId: laptopSpecsGroup.id, sortOrder: 2 },
      { name: 'Vi xử lý', slug: 'vi-xu-ly', type: 'text', filterable: true, isVariant: false, groupId: laptopSpecsGroup.id, sortOrder: 3 },
      { name: 'RAM', slug: 'ram', type: 'text', filterable: true, isVariant: false, groupId: laptopSpecsGroup.id, sortOrder: 4 },
    ])
    .returning();

  // Tablet attributes
  const [
    tabletStorage,
    tabletColor,
    tabletProcessor,
  ] = await db
    .insert(attributes)
    .values([
      { name: 'Dung lượng', slug: 'dung-luong', type: 'text', filterable: true, isVariant: true, groupId: tabletSpecsGroup.id, sortOrder: 1 },
      { name: 'Màu sắc', slug: 'mau-sac', type: 'text', filterable: true, isVariant: true, groupId: tabletSpecsGroup.id, sortOrder: 2 },
      { name: 'Vi xử lý', slug: 'vi-xu-ly', type: 'text', filterable: true, isVariant: false, groupId: tabletSpecsGroup.id, sortOrder: 3 },
    ])
    .returning();

  // Accessory attributes
  const [accColor, accConnectivity] = await db
    .insert(attributes)
    .values([
      { name: 'Màu sắc', slug: 'mau-sac', type: 'text', filterable: true, isVariant: true, groupId: accessorySpecsGroup.id, sortOrder: 1 },
      { name: 'Kết nối', slug: 'ket-noi', type: 'text', filterable: true, isVariant: false, groupId: accessorySpecsGroup.id, sortOrder: 2 },
    ])
    .returning();

  // ── 7. ATTRIBUTE OPTIONS ───────────────────
  console.log('🌱 Seeding attribute options...');

  // Phone storage options
  const [
    opt128, opt256, opt512, opt1TB,
  ] = await db
    .insert(attribute_options)
    .values([
      { attributeId: phoneStorage.id, value: '128GB', slug: '128gb' },
      { attributeId: phoneStorage.id, value: '256GB', slug: '256gb' },
      { attributeId: phoneStorage.id, value: '512GB', slug: '512gb' },
      { attributeId: phoneStorage.id, value: '1TB', slug: '1tb' },
    ])
    .returning();

  // Phone color options
  const [
    optDen, optTrang, optSaMac, optVangHong, optXanhDuong, optXamTitan, optDenTitan,
  ] = await db
    .insert(attribute_options)
    .values([
      { attributeId: phoneColor.id, value: 'Titan Đen', slug: 'titan-den' },
      { attributeId: phoneColor.id, value: 'Titan Trắng', slug: 'titan-trang' },
      { attributeId: phoneColor.id, value: 'Titan Sa mạc', slug: 'titan-sa-mac' },
      { attributeId: phoneColor.id, value: 'Vàng Hồng', slug: 'vang-hong' },
      { attributeId: phoneColor.id, value: 'Xanh Dương', slug: 'xanh-duong' },
      { attributeId: phoneColor.id, value: 'Xám Titan', slug: 'xam-titan' },
      { attributeId: phoneColor.id, value: 'Đen Titan', slug: 'den-titan' },
    ])
    .returning();

  // Laptop storage options
  const [
    laptopOpt512, laptopOpt1TB, laptopOpt2TB,
  ] = await db
    .insert(attribute_options)
    .values([
      { attributeId: laptopStorage.id, value: '512GB SSD', slug: '512gb-ssd' },
      { attributeId: laptopStorage.id, value: '1TB SSD', slug: '1tb-ssd' },
      { attributeId: laptopStorage.id, value: '2TB SSD', slug: '2tb-ssd' },
    ])
    .returning();

  // Laptop color options
  const [
    laptopOptXam, laptopOptDen, laptopOptBac,
  ] = await db
    .insert(attribute_options)
    .values([
      { attributeId: laptopColor.id, value: 'Xám Vũ Trụ', slug: 'xam-vu-tru' },
      { attributeId: laptopColor.id, value: 'Đen', slug: 'den' },
      { attributeId: laptopColor.id, value: 'Bạc', slug: 'bac' },
    ])
    .returning();

  // Tablet storage options
  const [
    tabOpt256, tabOpt512, tabOpt1TB,
  ] = await db
    .insert(attribute_options)
    .values([
      { attributeId: tabletStorage.id, value: '256GB', slug: 'tab-256gb' },
      { attributeId: tabletStorage.id, value: '512GB', slug: 'tab-512gb' },
      { attributeId: tabletStorage.id, value: '1TB', slug: 'tab-1tb' },
    ])
    .returning();

  // Tablet color options
  const [tabOptXam, tabOptBac, tabOptDen] = await db
    .insert(attribute_options)
    .values([
      { attributeId: tabletColor.id, value: 'Xám Vũ Trụ', slug: 'tab-xam' },
      { attributeId: tabletColor.id, value: 'Bạc', slug: 'tab-bac' },
      { attributeId: tabletColor.id, value: 'Đen Vũ Trụ', slug: 'tab-den' },
    ])
    .returning();

  // Accessory color options
  const [accOptTrang, accOptDen, accOptXanh] = await db
    .insert(attribute_options)
    .values([
      { attributeId: accColor.id, value: 'Trắng', slug: 'acc-trang' },
      { attributeId: accColor.id, value: 'Đen', slug: 'acc-den' },
      { attributeId: accColor.id, value: 'Xanh Lá', slug: 'acc-xanh' },
    ])
    .returning();

  console.log('🌱 Seeding products...');

  // ═══════════════════════════════════════════
  //  PRODUCT 1: iPhone 16 Pro Max  (Apple Phone)
  // ═══════════════════════════════════════════
  const [ip16pm] = await db.insert(products).values({
    categoryId: catApplePhone.id,
    brandId: apple.id,
    name: 'iPhone 16 Pro Max',
    slug: 'iphone-16-pro-max',
    description: 'Chiếc iPhone tuyệt đỉnh với chip A18 Pro và camera 48MP.',
  }).returning();

  await db.insert(product_attribute_values).values([
    { productId: ip16pm.id, attributeId: phoneProcessor.id, value: 'Apple A18 Pro' },
    { productId: ip16pm.id, attributeId: phoneRam.id, value: '8GB' },
  ]);

  const [ip16pmImg1, ip16pmImg2] = await db.insert(product_images).values([
    { productId: ip16pm.id, url: IMG.ip16pm_desert, isMain: true, sortOrder: 1 },
    { productId: ip16pm.id, url: IMG.ip16pm_desert, isMain: false, sortOrder: 2 },
  ]).returning();

  const [ip16pmV1, ip16pmV2] = await db.insert(product_variants).values([
    { productId: ip16pm.id, sku: 'IP16PM-256-BLK', price: 34990000, stock: 100, name: 'iPhone 16 Pro Max 256GB Titan Đen' },
    { productId: ip16pm.id, sku: 'IP16PM-512-DST', price: 40990000, stock: 50, name: 'iPhone 16 Pro Max 512GB Titan Sa mạc' },
  ]).returning();

  await db.insert(variant_images).values([
    { variantId: ip16pmV1.id, imageId: ip16pmImg1.id, isMain: true },
    { variantId: ip16pmV2.id, imageId: ip16pmImg2.id, isMain: true },
  ]);

  await db.insert(variant_attribute_values).values([
    { variantId: ip16pmV1.id, attributeId: phoneStorage.id, optionId: opt256.id },
    { variantId: ip16pmV1.id, attributeId: phoneColor.id, optionId: optDen.id },
    { variantId: ip16pmV2.id, attributeId: phoneStorage.id, optionId: opt512.id },
    { variantId: ip16pmV2.id, attributeId: phoneColor.id, optionId: optSaMac.id },
  ]);

  // ═══════════════════════════════════════════
  //  PRODUCT 2: iPhone 15  (Apple Phone)
  // ═══════════════════════════════════════════
  const [ip15] = await db.insert(products).values({
    categoryId: catApplePhone.id,
    brandId: apple.id,
    name: 'iPhone 15',
    slug: 'iphone-15',
    description: 'Dynamic Island trên mọi model, camera 48MP, chip A16 Bionic.',
  }).returning();

  await db.insert(product_attribute_values).values([
    { productId: ip15.id, attributeId: phoneProcessor.id, value: 'Apple A16 Bionic' },
    { productId: ip15.id, attributeId: phoneRam.id, value: '6GB' },
  ]);

  const [ip15Img1, ip15Img2] = await db.insert(product_images).values([
    { productId: ip15.id, url: IMG.ip15_black, isMain: true, sortOrder: 1 },
    { productId: ip15.id, url: IMG.ip15_black, isMain: false, sortOrder: 2 },
  ]).returning();

  const [ip15V1, ip15V2] = await db.insert(product_variants).values([
    { productId: ip15.id, sku: 'IP15-128-BLK', price: 22990000, stock: 150, name: 'iPhone 15 128GB Đen' },
    { productId: ip15.id, sku: 'IP15-256-PNK', price: 25990000, stock: 80, name: 'iPhone 15 256GB Vàng Hồng' },
  ]).returning();

  await db.insert(variant_images).values([
    { variantId: ip15V1.id, imageId: ip15Img1.id, isMain: true },
    { variantId: ip15V2.id, imageId: ip15Img2.id, isMain: true },
  ]);

  await db.insert(variant_attribute_values).values([
    { variantId: ip15V1.id, attributeId: phoneStorage.id, optionId: opt128.id },
    { variantId: ip15V1.id, attributeId: phoneColor.id, optionId: optDen.id },
    { variantId: ip15V2.id, attributeId: phoneStorage.id, optionId: opt256.id },
    { variantId: ip15V2.id, attributeId: phoneColor.id, optionId: optVangHong.id },
  ]);

  // ═══════════════════════════════════════════
  //  PRODUCT 3: Samsung Galaxy S24 Ultra  (Samsung Phone)
  // ═══════════════════════════════════════════
  const [ss24u] = await db.insert(products).values({
    categoryId: catSamsungPhone.id,
    brandId: samsung.id,
    name: 'Samsung Galaxy S24 Ultra',
    slug: 'samsung-galaxy-s24-ultra',
    description: 'Galaxy AI là đây. Bút S Pen tích hợp, camera 200MP.',
  }).returning();

  await db.insert(product_attribute_values).values([
    { productId: ss24u.id, attributeId: phoneProcessor.id, value: 'Snapdragon 8 Gen 3 for Galaxy' },
    { productId: ss24u.id, attributeId: phoneRam.id, value: '12GB' },
  ]);

  const [ss24uImg1, ss24uImg2] = await db.insert(product_images).values([
    { productId: ss24u.id, url: IMG.s24_ultra_gray, isMain: true, sortOrder: 1 },
    { productId: ss24u.id, url: IMG.s24_ultra_black, isMain: false, sortOrder: 2 },
  ]).returning();

  const [ss24uV1, ss24uV2] = await db.insert(product_variants).values([
    { productId: ss24u.id, sku: 'SS24U-256-GRY', price: 33990000, stock: 80, name: 'Samsung Galaxy S24 Ultra 256GB Xám Titan' },
    { productId: ss24u.id, sku: 'SS24U-1TB-BLK', price: 44990000, stock: 30, name: 'Samsung Galaxy S24 Ultra 1TB Đen Titan' },
  ]).returning();

  await db.insert(variant_images).values([
    { variantId: ss24uV1.id, imageId: ss24uImg1.id, isMain: true },
    { variantId: ss24uV2.id, imageId: ss24uImg2.id, isMain: true },
  ]);

  await db.insert(variant_attribute_values).values([
    { variantId: ss24uV1.id, attributeId: phoneStorage.id, optionId: opt256.id },
    { variantId: ss24uV1.id, attributeId: phoneColor.id, optionId: optXamTitan.id },
    { variantId: ss24uV2.id, attributeId: phoneStorage.id, optionId: opt1TB.id },
    { variantId: ss24uV2.id, attributeId: phoneColor.id, optionId: optDenTitan.id },
  ]);

  // ═══════════════════════════════════════════
  //  PRODUCT 4: Samsung Galaxy S24+  (Samsung Phone)
  // ═══════════════════════════════════════════
  const [ss24p] = await db.insert(products).values({
    categoryId: catSamsungPhone.id,
    brandId: samsung.id,
    name: 'Samsung Galaxy S24+',
    slug: 'samsung-galaxy-s24-plus',
    description: 'Màn hình 6.7" Dynamic AMOLED 2X, AI thế hệ mới.',
  }).returning();

  await db.insert(product_attribute_values).values([
    { productId: ss24p.id, attributeId: phoneProcessor.id, value: 'Snapdragon 8 Gen 3' },
    { productId: ss24p.id, attributeId: phoneRam.id, value: '12GB' },
  ]);

  const [ss24pImg1] = await db.insert(product_images).values([
    { productId: ss24p.id, url: IMG.s24_ultra_gray, isMain: true, sortOrder: 1 },
  ]).returning();

  const [ss24pV1, ss24pV2] = await db.insert(product_variants).values([
    { productId: ss24p.id, sku: 'SS24P-256-GRY', price: 26990000, stock: 60, name: 'Samsung Galaxy S24+ 256GB Xám Titan' },
    { productId: ss24p.id, sku: 'SS24P-512-BLK', price: 30990000, stock: 40, name: 'Samsung Galaxy S24+ 512GB Đen Titan' },
  ]).returning();

  await db.insert(variant_images).values([
    { variantId: ss24pV1.id, imageId: ss24pImg1.id, isMain: true },
    { variantId: ss24pV2.id, imageId: ss24pImg1.id, isMain: true },
  ]);

  await db.insert(variant_attribute_values).values([
    { variantId: ss24pV1.id, attributeId: phoneStorage.id, optionId: opt256.id },
    { variantId: ss24pV1.id, attributeId: phoneColor.id, optionId: optXamTitan.id },
    { variantId: ss24pV2.id, attributeId: phoneStorage.id, optionId: opt512.id },
    { variantId: ss24pV2.id, attributeId: phoneColor.id, optionId: optDenTitan.id },
  ]);

  // ═══════════════════════════════════════════
  //  PRODUCT 5: Xiaomi 14  (Xiaomi Phone)
  // ═══════════════════════════════════════════
  const [mi14] = await db.insert(products).values({
    categoryId: catXiaomiPhone.id,
    brandId: xiaomi.id,
    name: 'Xiaomi 14',
    slug: 'xiaomi-14',
    description: 'Camera Leica đỉnh cao, sạc siêu nhanh 90W, Snapdragon 8 Gen 3.',
  }).returning();

  await db.insert(product_attribute_values).values([
    { productId: mi14.id, attributeId: phoneProcessor.id, value: 'Snapdragon 8 Gen 3' },
    { productId: mi14.id, attributeId: phoneRam.id, value: '12GB' },
  ]);

  const [mi14Img1, mi14Img2] = await db.insert(product_images).values([
    { productId: mi14.id, url: IMG.mi14_black, isMain: true, sortOrder: 1 },
    { productId: mi14.id, url: IMG.mi14_white, isMain: false, sortOrder: 2 },
  ]).returning();

  const [mi14V1, mi14V2] = await db.insert(product_variants).values([
    { productId: mi14.id, sku: 'MI14-256-BLK', price: 22990000, stock: 70, name: 'Xiaomi 14 256GB Đen' },
    { productId: mi14.id, sku: 'MI14-512-WHT', price: 27990000, stock: 50, name: 'Xiaomi 14 512GB Trắng' },
  ]).returning();

  await db.insert(variant_images).values([
    { variantId: mi14V1.id, imageId: mi14Img1.id, isMain: true },
    { variantId: mi14V2.id, imageId: mi14Img2.id, isMain: true },
  ]);

  await db.insert(variant_attribute_values).values([
    { variantId: mi14V1.id, attributeId: phoneStorage.id, optionId: opt256.id },
    { variantId: mi14V1.id, attributeId: phoneColor.id, optionId: optDen.id },
    { variantId: mi14V2.id, attributeId: phoneStorage.id, optionId: opt512.id },
    { variantId: mi14V2.id, attributeId: phoneColor.id, optionId: optTrang.id },
  ]);

  // ═══════════════════════════════════════════
  //  PRODUCT 6: Xiaomi Redmi Note 13 Pro+  (Xiaomi Phone)
  // ═══════════════════════════════════════════
  const [redmiNote13] = await db.insert(products).values({
    categoryId: catXiaomiPhone.id,
    brandId: xiaomi.id,
    name: 'Xiaomi Redmi Note 13 Pro+',
    slug: 'xiaomi-redmi-note-13-pro-plus',
    description: 'Camera 200MP, sạc siêu nhanh 120W, màn hình 120Hz AMOLED.',
  }).returning();

  await db.insert(product_attribute_values).values([
    { productId: redmiNote13.id, attributeId: phoneProcessor.id, value: 'MediaTek Dimensity 7200 Ultra' },
    { productId: redmiNote13.id, attributeId: phoneRam.id, value: '12GB' },
  ]);

  const [rn13Img1] = await db.insert(product_images).values([
    { productId: redmiNote13.id, url: IMG.mi14_black, isMain: true, sortOrder: 1 },
  ]).returning();

  const [rn13V1, rn13V2] = await db.insert(product_variants).values([
    { productId: redmiNote13.id, sku: 'RN13P-256-BLK', price: 9990000, stock: 120, name: 'Redmi Note 13 Pro+ 256GB Đen' },
    { productId: redmiNote13.id, sku: 'RN13P-256-BLU', price: 9990000, stock: 90, name: 'Redmi Note 13 Pro+ 256GB Xanh Dương' },
  ]).returning();

  await db.insert(variant_images).values([
    { variantId: rn13V1.id, imageId: rn13Img1.id, isMain: true },
    { variantId: rn13V2.id, imageId: rn13Img1.id, isMain: true },
  ]);

  await db.insert(variant_attribute_values).values([
    { variantId: rn13V1.id, attributeId: phoneStorage.id, optionId: opt256.id },
    { variantId: rn13V1.id, attributeId: phoneColor.id, optionId: optDen.id },
    { variantId: rn13V2.id, attributeId: phoneStorage.id, optionId: opt256.id },
    { variantId: rn13V2.id, attributeId: phoneColor.id, optionId: optXanhDuong.id },
  ]);

  // ═══════════════════════════════════════════
  //  PRODUCT 7: OPPO Find X7 Ultra  (OPPO Phone)
  // ═══════════════════════════════════════════
  const [findX7] = await db.insert(products).values({
    categoryId: catOppoPhone.id,
    brandId: oppo.id,
    name: 'OPPO Find X7 Ultra',
    slug: 'oppo-find-x7-ultra',
    description: 'Camera Hasselblad, zoom quang học 6x, sạc không dây 50W.',
  }).returning();

  await db.insert(product_attribute_values).values([
    { productId: findX7.id, attributeId: phoneProcessor.id, value: 'Snapdragon 8 Gen 3' },
    { productId: findX7.id, attributeId: phoneRam.id, value: '16GB' },
  ]);

  const [fx7Img1] = await db.insert(product_images).values([
    { productId: findX7.id, url: IMG.find_x7_black, isMain: true, sortOrder: 1 },
  ]).returning();

  const [fx7V1, fx7V2] = await db.insert(product_variants).values([
    { productId: findX7.id, sku: 'FX7U-256-BLK', price: 29990000, stock: 45, name: 'OPPO Find X7 Ultra 256GB Đen' },
    { productId: findX7.id, sku: 'FX7U-512-BLK', price: 34990000, stock: 30, name: 'OPPO Find X7 Ultra 512GB Đen' },
  ]).returning();

  await db.insert(variant_images).values([
    { variantId: fx7V1.id, imageId: fx7Img1.id, isMain: true },
    { variantId: fx7V2.id, imageId: fx7Img1.id, isMain: true },
  ]);

  await db.insert(variant_attribute_values).values([
    { variantId: fx7V1.id, attributeId: phoneStorage.id, optionId: opt256.id },
    { variantId: fx7V1.id, attributeId: phoneColor.id, optionId: optDen.id },
    { variantId: fx7V2.id, attributeId: phoneStorage.id, optionId: opt512.id },
    { variantId: fx7V2.id, attributeId: phoneColor.id, optionId: optDen.id },
  ]);

  // ═══════════════════════════════════════════
  //  PRODUCT 8: OPPO Reno 11  (OPPO Phone)
  // ═══════════════════════════════════════════
  const [reno11] = await db.insert(products).values({
    categoryId: catOppoPhone.id,
    brandId: oppo.id,
    name: 'OPPO Reno 11',
    slug: 'oppo-reno-11',
    description: 'Thiết kế mỏng nhẹ, camera dọc 64MP, sạc nhanh 67W.',
  }).returning();

  await db.insert(product_attribute_values).values([
    { productId: reno11.id, attributeId: phoneProcessor.id, value: 'MediaTek Dimensity 8200' },
    { productId: reno11.id, attributeId: phoneRam.id, value: '8GB' },
  ]);

  const [reno11Img1] = await db.insert(product_images).values([
    { productId: reno11.id, url: IMG.reno_11_blue, isMain: true, sortOrder: 1 },
  ]).returning();

  const [reno11V1, reno11V2] = await db.insert(product_variants).values([
    { productId: reno11.id, sku: 'RENO11-256-BLU', price: 11990000, stock: 80, name: 'OPPO Reno 11 256GB Xanh Dương' },
    { productId: reno11.id, sku: 'RENO11-256-PNK', price: 11990000, stock: 60, name: 'OPPO Reno 11 256GB Vàng Hồng' },
  ]).returning();

  await db.insert(variant_images).values([
    { variantId: reno11V1.id, imageId: reno11Img1.id, isMain: true },
    { variantId: reno11V2.id, imageId: reno11Img1.id, isMain: true },
  ]);

  await db.insert(variant_attribute_values).values([
    { variantId: reno11V1.id, attributeId: phoneStorage.id, optionId: opt256.id },
    { variantId: reno11V1.id, attributeId: phoneColor.id, optionId: optXanhDuong.id },
    { variantId: reno11V2.id, attributeId: phoneStorage.id, optionId: opt256.id },
    { variantId: reno11V2.id, attributeId: phoneColor.id, optionId: optVangHong.id },
  ]);

  // ═══════════════════════════════════════════
  //  PRODUCT 9: iPad Pro M4  (Apple Tablet)
  // ═══════════════════════════════════════════
  const [ipadPro] = await db.insert(products).values({
    categoryId: catAppleTablet.id,
    brandId: apple.id,
    name: 'iPad Pro M4 13 inch',
    slug: 'ipad-pro-m4-13-inch',
    description: 'Mỏng nhất từ trước đến nay, màn hình Ultra Retina XDR OLED kép.',
  }).returning();

  await db.insert(product_attribute_values).values([
    { productId: ipadPro.id, attributeId: tabletProcessor.id, value: 'Apple M4' },
  ]);

  const [ipadProImg1] = await db.insert(product_images).values([
    { productId: ipadPro.id, url: IMG.ipad_pro, isMain: true, sortOrder: 1 },
  ]).returning();

  const [ipadProV1, ipadProV2] = await db.insert(product_variants).values([
    { productId: ipadPro.id, sku: 'IPADPRO-M4-256-SLV', price: 30990000, stock: 40, name: 'iPad Pro M4 13 inch 256GB Bạc' },
    { productId: ipadPro.id, sku: 'IPADPRO-M4-1TB-SPC', price: 52990000, stock: 20, name: 'iPad Pro M4 13 inch 1TB Xám Vũ Trụ' },
  ]).returning();

  await db.insert(variant_images).values([
    { variantId: ipadProV1.id, imageId: ipadProImg1.id, isMain: true },
    { variantId: ipadProV2.id, imageId: ipadProImg1.id, isMain: true },
  ]);

  await db.insert(variant_attribute_values).values([
    { variantId: ipadProV1.id, attributeId: tabletStorage.id, optionId: tabOpt256.id },
    { variantId: ipadProV1.id, attributeId: tabletColor.id, optionId: tabOptBac.id },
    { variantId: ipadProV2.id, attributeId: tabletStorage.id, optionId: tabOpt1TB.id },
    { variantId: ipadProV2.id, attributeId: tabletColor.id, optionId: tabOptXam.id },
  ]);

  // ═══════════════════════════════════════════
  //  PRODUCT 10: Samsung Galaxy Tab S9 Ultra  (Samsung Tablet)
  // ═══════════════════════════════════════════
  const [tabS9] = await db.insert(products).values({
    categoryId: catSamsungTablet.id,
    brandId: samsung.id,
    name: 'Samsung Galaxy Tab S9 Ultra',
    slug: 'samsung-galaxy-tab-s9-ultra',
    description: 'Màn hình AMOLED 14.6", S Pen đi kèm, hiệu năng flagship.',
  }).returning();

  await db.insert(product_attribute_values).values([
    { productId: tabS9.id, attributeId: tabletProcessor.id, value: 'Snapdragon 8 Gen 2' },
  ]);

  const [tabS9Img1] = await db.insert(product_images).values([
    { productId: tabS9.id, url: IMG.tab_s9, isMain: true, sortOrder: 1 },
  ]).returning();

  const [tabS9V1, tabS9V2] = await db.insert(product_variants).values([
    { productId: tabS9.id, sku: 'TABS9U-256-GRY', price: 27990000, stock: 35, name: 'Galaxy Tab S9 Ultra 256GB Xám Vũ Trụ' },
    { productId: tabS9.id, sku: 'TABS9U-512-GRY', price: 32990000, stock: 20, name: 'Galaxy Tab S9 Ultra 512GB Xám Vũ Trụ' },
  ]).returning();

  await db.insert(variant_images).values([
    { variantId: tabS9V1.id, imageId: tabS9Img1.id, isMain: true },
    { variantId: tabS9V2.id, imageId: tabS9Img1.id, isMain: true },
  ]);

  await db.insert(variant_attribute_values).values([
    { variantId: tabS9V1.id, attributeId: tabletStorage.id, optionId: tabOpt256.id },
    { variantId: tabS9V1.id, attributeId: tabletColor.id, optionId: tabOptXam.id },
    { variantId: tabS9V2.id, attributeId: tabletStorage.id, optionId: tabOpt512.id },
    { variantId: tabS9V2.id, attributeId: tabletColor.id, optionId: tabOptXam.id },
  ]);

  // ═══════════════════════════════════════════
  //  PRODUCT 11: MacBook Air M3  (Laptop Văn phòng)
  // ═══════════════════════════════════════════
  const [mbAir] = await db.insert(products).values({
    categoryId: catLaptopVanPhong.id,
    brandId: apple.id,
    name: 'MacBook Air M3 13 inch',
    slug: 'macbook-air-m3-13-inch',
    description: 'Chip M3 thế hệ mới, thời lượng pin 18 giờ, màn hình Liquid Retina.',
  }).returning();

  await db.insert(product_attribute_values).values([
    { productId: mbAir.id, attributeId: laptopProcessor.id, value: 'Apple M3 8-core CPU' },
    { productId: mbAir.id, attributeId: laptopRam.id, value: '8GB' },
  ]);

  const [mbAirImg1] = await db.insert(product_images).values([
    { productId: mbAir.id, url: IMG.macbook_air, isMain: true, sortOrder: 1 },
  ]).returning();

  const [mbAirV1, mbAirV2] = await db.insert(product_variants).values([
    { productId: mbAir.id, sku: 'MBA-M3-256-SPC', price: 27990000, stock: 50, name: 'MacBook Air M3 256GB Xám Vũ Trụ' },
    { productId: mbAir.id, sku: 'MBA-M3-512-SLV', price: 33990000, stock: 35, name: 'MacBook Air M3 512GB Bạc' },
  ]).returning();

  await db.insert(variant_images).values([
    { variantId: mbAirV1.id, imageId: mbAirImg1.id, isMain: true },
    { variantId: mbAirV2.id, imageId: mbAirImg1.id, isMain: true },
  ]);

  await db.insert(variant_attribute_values).values([
    { variantId: mbAirV1.id, attributeId: laptopStorage.id, optionId: laptopOpt512.id },
    { variantId: mbAirV1.id, attributeId: laptopColor.id, optionId: laptopOptXam.id },
    { variantId: mbAirV2.id, attributeId: laptopStorage.id, optionId: laptopOpt512.id },
    { variantId: mbAirV2.id, attributeId: laptopColor.id, optionId: laptopOptBac.id },
  ]);

  // ═══════════════════════════════════════════
  //  PRODUCT 12: Dell XPS 15  (Laptop Văn phòng)
  // ═══════════════════════════════════════════
  const [dellXps] = await db.insert(products).values({
    categoryId: catLaptopVanPhong.id,
    brandId: dell.id,
    name: 'Dell XPS 15 9530',
    slug: 'dell-xps-15-9530',
    description: 'Màn hình OLED 3.5K, Intel Core i9, đồ họa RTX 4070.',
  }).returning();

  await db.insert(product_attribute_values).values([
    { productId: dellXps.id, attributeId: laptopProcessor.id, value: 'Intel Core i9-13900H' },
    { productId: dellXps.id, attributeId: laptopRam.id, value: '32GB DDR5' },
  ]);

  const [dellXpsImg1] = await db.insert(product_images).values([
    { productId: dellXps.id, url: IMG.dell_xps, isMain: true, sortOrder: 1 },
  ]).returning();

  const [dellXpsV1, dellXpsV2] = await db.insert(product_variants).values([
    { productId: dellXps.id, sku: 'XPS15-1TB-SLV', price: 52990000, stock: 20, name: 'Dell XPS 15 1TB Bạc' },
    { productId: dellXps.id, sku: 'XPS15-2TB-SLV', price: 64990000, stock: 10, name: 'Dell XPS 15 2TB Bạc' },
  ]).returning();

  await db.insert(variant_images).values([
    { variantId: dellXpsV1.id, imageId: dellXpsImg1.id, isMain: true },
    { variantId: dellXpsV2.id, imageId: dellXpsImg1.id, isMain: true },
  ]);

  await db.insert(variant_attribute_values).values([
    { variantId: dellXpsV1.id, attributeId: laptopStorage.id, optionId: laptopOpt1TB.id },
    { variantId: dellXpsV1.id, attributeId: laptopColor.id, optionId: laptopOptBac.id },
    { variantId: dellXpsV2.id, attributeId: laptopStorage.id, optionId: laptopOpt2TB.id },
    { variantId: dellXpsV2.id, attributeId: laptopColor.id, optionId: laptopOptBac.id },
  ]);

  // ═══════════════════════════════════════════
  //  PRODUCT 13: ASUS ROG Zephyrus G14  (Laptop Gaming)
  // ═══════════════════════════════════════════
  const [rogG14] = await db.insert(products).values({
    categoryId: catLaptopGaming.id,
    brandId: asus.id,
    name: 'ASUS ROG Zephyrus G14 (2024)',
    slug: 'asus-rog-zephyrus-g14-2024',
    description: 'Gaming laptop mỏng nhẹ, Ryzen 9 8945HS, RTX 4070.',
  }).returning();

  await db.insert(product_attribute_values).values([
    { productId: rogG14.id, attributeId: laptopProcessor.id, value: 'AMD Ryzen 9 8945HS' },
    { productId: rogG14.id, attributeId: laptopRam.id, value: '32GB LPDDR5X' },
  ]);

  const [rogG14Img1] = await db.insert(product_images).values([
    { productId: rogG14.id, url: IMG.asus_rog, isMain: true, sortOrder: 1 },
  ]).returning();

  const [rogG14V1, rogG14V2] = await db.insert(product_variants).values([
    { productId: rogG14.id, sku: 'ROGG14-1TB-GRY', price: 44990000, stock: 25, name: 'ROG Zephyrus G14 1TB Xám' },
    { productId: rogG14.id, sku: 'ROGG14-1TB-BLK', price: 45990000, stock: 15, name: 'ROG Zephyrus G14 1TB Đen' },
  ]).returning();

  await db.insert(variant_images).values([
    { variantId: rogG14V1.id, imageId: rogG14Img1.id, isMain: true },
    { variantId: rogG14V2.id, imageId: rogG14Img1.id, isMain: true },
  ]);

  await db.insert(variant_attribute_values).values([
    { variantId: rogG14V1.id, attributeId: laptopStorage.id, optionId: laptopOpt1TB.id },
    { variantId: rogG14V1.id, attributeId: laptopColor.id, optionId: laptopOptXam.id },
    { variantId: rogG14V2.id, attributeId: laptopStorage.id, optionId: laptopOpt1TB.id },
    { variantId: rogG14V2.id, attributeId: laptopColor.id, optionId: laptopOptDen.id },
  ]);

  // ═══════════════════════════════════════════
  //  PRODUCT 14: ASUS ROG Strix G16  (Laptop Gaming)
  // ═══════════════════════════════════════════
  const [rogStrix] = await db.insert(products).values({
    categoryId: catLaptopGaming.id,
    brandId: asus.id,
    name: 'ASUS ROG Strix G16 (2024)',
    slug: 'asus-rog-strix-g16-2024',
    description: 'Màn hình 240Hz, Intel Core i9, RTX 4090 laptop GPU.',
  }).returning();

  await db.insert(product_attribute_values).values([
    { productId: rogStrix.id, attributeId: laptopProcessor.id, value: 'Intel Core i9-14900HX' },
    { productId: rogStrix.id, attributeId: laptopRam.id, value: '32GB DDR5' },
  ]);

  const [rogStrixImg1] = await db.insert(product_images).values([
    { productId: rogStrix.id, url: IMG.asus_rog, isMain: true, sortOrder: 1 },
  ]).returning();

  const [rogStrixV1] = await db.insert(product_variants).values([
    { productId: rogStrix.id, sku: 'ROGSG16-1TB-BLK', price: 62990000, stock: 12, name: 'ROG Strix G16 1TB Đen' },
  ]).returning();

  await db.insert(variant_images).values([
    { variantId: rogStrixV1.id, imageId: rogStrixImg1.id, isMain: true },
  ]);

  await db.insert(variant_attribute_values).values([
    { variantId: rogStrixV1.id, attributeId: laptopStorage.id, optionId: laptopOpt1TB.id },
    { variantId: rogStrixV1.id, attributeId: laptopColor.id, optionId: laptopOptDen.id },
  ]);

  // ═══════════════════════════════════════════
  //  PRODUCT 15: AirPods Pro 2 (USB-C)  (Tai nghe)
  // ═══════════════════════════════════════════
  const [airpodsPro] = await db.insert(products).values({
    categoryId: catTaiNghe.id,
    brandId: apple.id,
    name: 'AirPods Pro 2 (USB-C)',
    slug: 'airpods-pro-2-usb-c',
    description: 'Chống ồn chủ động H2, âm thanh Adaptive, Lossless Audio.',
  }).returning();

  await db.insert(product_attribute_values).values([
    { productId: airpodsPro.id, attributeId: accConnectivity.id, value: 'Bluetooth 5.3' },
  ]);

  const [airpodsProImg1] = await db.insert(product_images).values([
    { productId: airpodsPro.id, url: IMG.airpods_pro, isMain: true, sortOrder: 1 },
  ]).returning();

  const [airpodsProV1] = await db.insert(product_variants).values([
    { productId: airpodsPro.id, sku: 'APP2-USBC-WHT', price: 6490000, stock: 200, name: 'AirPods Pro 2 USB-C Trắng' },
  ]).returning();

  await db.insert(variant_images).values([
    { variantId: airpodsProV1.id, imageId: airpodsProImg1.id, isMain: true },
  ]);

  await db.insert(variant_attribute_values).values([
    { variantId: airpodsProV1.id, attributeId: accColor.id, optionId: accOptTrang.id },
  ]);

  // ═══════════════════════════════════════════
  //  PRODUCT 16: Samsung Galaxy Buds3 Pro  (Tai nghe)
  // ═══════════════════════════════════════════
  const [galaxyBuds] = await db.insert(products).values({
    categoryId: catTaiNghe.id,
    brandId: samsung.id,
    name: 'Samsung Galaxy Buds3 Pro',
    slug: 'samsung-galaxy-buds3-pro',
    description: 'ANC thế hệ mới, âm thanh Hi-Fi, pin 30 giờ.',
  }).returning();

  await db.insert(product_attribute_values).values([
    { productId: galaxyBuds.id, attributeId: accConnectivity.id, value: 'Bluetooth 5.4' },
  ]);

  const [galaxyBudsImg1] = await db.insert(product_images).values([
    { productId: galaxyBuds.id, url: IMG.galaxy_buds, isMain: true, sortOrder: 1 },
  ]).returning();

  const [budsV1, budsV2] = await db.insert(product_variants).values([
    { productId: galaxyBuds.id, sku: 'GBP3-WHT', price: 5490000, stock: 150, name: 'Galaxy Buds3 Pro Trắng' },
    { productId: galaxyBuds.id, sku: 'GBP3-BLK', price: 5490000, stock: 120, name: 'Galaxy Buds3 Pro Đen' },
  ]).returning();

  await db.insert(variant_images).values([
    { variantId: budsV1.id, imageId: galaxyBudsImg1.id, isMain: true },
    { variantId: budsV2.id, imageId: galaxyBudsImg1.id, isMain: true },
  ]);

  await db.insert(variant_attribute_values).values([
    { variantId: budsV1.id, attributeId: accColor.id, optionId: accOptTrang.id },
    { variantId: budsV2.id, attributeId: accColor.id, optionId: accOptDen.id },
  ]);

  // ═══════════════════════════════════════════
  //  PRODUCT 17: Logitech MX Master 3S  (Chuột & Bàn phím)
  // ═══════════════════════════════════════════
  const [mxMaster] = await db.insert(products).values({
    categoryId: catChuotBanPhim.id,
    brandId: logitech.id,
    name: 'Logitech MX Master 3S',
    slug: 'logitech-mx-master-3s',
    description: 'Chuột cao cấp 8K DPI, cuộn im lặng MagSpeed, kết nối đa thiết bị.',
  }).returning();

  await db.insert(product_attribute_values).values([
    { productId: mxMaster.id, attributeId: accConnectivity.id, value: 'Bluetooth + USB Receiver' },
  ]);

  const [mxImg1] = await db.insert(product_images).values([
    { productId: mxMaster.id, url: IMG.logitech_mx, isMain: true, sortOrder: 1 },
  ]).returning();

  const [mxV1, mxV2] = await db.insert(product_variants).values([
    { productId: mxMaster.id, sku: 'MXM3S-BLK', price: 2290000, stock: 300, name: 'Logitech MX Master 3S Đen' },
    { productId: mxMaster.id, sku: 'MXM3S-WHT', price: 2290000, stock: 250, name: 'Logitech MX Master 3S Trắng' },
  ]).returning();

  await db.insert(variant_images).values([
    { variantId: mxV1.id, imageId: mxImg1.id, isMain: true },
    { variantId: mxV2.id, imageId: mxImg1.id, isMain: true },
  ]);

  await db.insert(variant_attribute_values).values([
    { variantId: mxV1.id, attributeId: accColor.id, optionId: accOptDen.id },
    { variantId: mxV2.id, attributeId: accColor.id, optionId: accOptTrang.id },
  ]);

  // ═══════════════════════════════════════════
  //  PRODUCT 18: Logitech MX Keys S  (Chuột & Bàn phím)
  // ═══════════════════════════════════════════
  const [mxKeys] = await db.insert(products).values({
    categoryId: catChuotBanPhim.id,
    brandId: logitech.id,
    name: 'Logitech MX Keys S',
    slug: 'logitech-mx-keys-s',
    description: 'Bàn phím không dây thông minh, phím có đèn nền thích ứng, pin 10 ngày.',
  }).returning();

  await db.insert(product_attribute_values).values([
    { productId: mxKeys.id, attributeId: accConnectivity.id, value: 'Bluetooth + USB Receiver' },
  ]);

  const [mxKeysImg1] = await db.insert(product_images).values([
    { productId: mxKeys.id, url: IMG.logitech_mx, isMain: true, sortOrder: 1 },
  ]).returning();

  const [mxKeysV1, mxKeysV2] = await db.insert(product_variants).values([
    { productId: mxKeys.id, sku: 'MXKS-BLK', price: 2790000, stock: 200, name: 'Logitech MX Keys S Đen' },
    { productId: mxKeys.id, sku: 'MXKS-GRN', price: 2790000, stock: 150, name: 'Logitech MX Keys S Xanh Lá' },
  ]).returning();

  await db.insert(variant_images).values([
    { variantId: mxKeysV1.id, imageId: mxKeysImg1.id, isMain: true },
    { variantId: mxKeysV2.id, imageId: mxKeysImg1.id, isMain: true },
  ]);

  await db.insert(variant_attribute_values).values([
    { variantId: mxKeysV1.id, attributeId: accColor.id, optionId: accOptDen.id },
    { variantId: mxKeysV2.id, attributeId: accColor.id, optionId: accOptXanh.id },
  ]);

  // ═══════════════════════════════════════════
  //  PRODUCT 19: Xiaomi Pad 6 Pro  (Samsung Tablet - reused as generic tablet)
  // ═══════════════════════════════════════════
  const [xiaomiPad6] = await db.insert(products).values({
    categoryId: catSamsungTablet.id,
    brandId: xiaomi.id,
    name: 'Xiaomi Pad 6 Pro',
    slug: 'xiaomi-pad-6-pro',
    description: 'Màn hình 2.8K 144Hz, Snapdragon 8+ Gen 1, loa Dolby Atmos.',
  }).returning();

  await db.insert(product_attribute_values).values([
    { productId: xiaomiPad6.id, attributeId: tabletProcessor.id, value: 'Snapdragon 8+ Gen 1' },
  ]);

  const [xPadImg1] = await db.insert(product_images).values([
    { productId: xiaomiPad6.id, url: IMG.tab_s9, isMain: true, sortOrder: 1 },
  ]).returning();

  const [xPadV1, xPadV2] = await db.insert(product_variants).values([
    { productId: xiaomiPad6.id, sku: 'XPAD6P-256-GRY', price: 10990000, stock: 55, name: 'Xiaomi Pad 6 Pro 256GB Xám' },
    { productId: xiaomiPad6.id, sku: 'XPAD6P-512-BLK', price: 13490000, stock: 35, name: 'Xiaomi Pad 6 Pro 512GB Đen' },
  ]).returning();

  await db.insert(variant_images).values([
    { variantId: xPadV1.id, imageId: xPadImg1.id, isMain: true },
    { variantId: xPadV2.id, imageId: xPadImg1.id, isMain: true },
  ]);

  await db.insert(variant_attribute_values).values([
    { variantId: xPadV1.id, attributeId: tabletStorage.id, optionId: tabOpt256.id },
    { variantId: xPadV1.id, attributeId: tabletColor.id, optionId: tabOptXam.id },
    { variantId: xPadV2.id, attributeId: tabletStorage.id, optionId: tabOpt512.id },
    { variantId: xPadV2.id, attributeId: tabletColor.id, optionId: tabOptDen.id },
  ]);

  // ═══════════════════════════════════════════
  //  PRODUCT 20: iPhone 16  (Apple Phone)
  // ═══════════════════════════════════════════
  const [ip16] = await db.insert(products).values({
    categoryId: catApplePhone.id,
    brandId: apple.id,
    name: 'iPhone 16',
    slug: 'iphone-16',
    description: 'Nút Camera Control mới, chip A18, Apple Intelligence.',
  }).returning();

  await db.insert(product_attribute_values).values([
    { productId: ip16.id, attributeId: phoneProcessor.id, value: 'Apple A18' },
    { productId: ip16.id, attributeId: phoneRam.id, value: '8GB' },
  ]);

  const [ip16Img1] = await db.insert(product_images).values([
    { productId: ip16.id, url: IMG.ip15_black, isMain: true, sortOrder: 1 },
  ]).returning();

  const [ip16V1, ip16V2, ip16V3] = await db.insert(product_variants).values([
    { productId: ip16.id, sku: 'IP16-128-BLK', price: 22990000, stock: 200, name: 'iPhone 16 128GB Titan Đen' },
    { productId: ip16.id, sku: 'IP16-256-WHT', price: 25990000, stock: 150, name: 'iPhone 16 256GB Titan Trắng' },
    { productId: ip16.id, sku: 'IP16-512-PNK', price: 32990000, stock: 80, name: 'iPhone 16 512GB Vàng Hồng' },
  ]).returning();

  await db.insert(variant_images).values([
    { variantId: ip16V1.id, imageId: ip16Img1.id, isMain: true },
    { variantId: ip16V2.id, imageId: ip16Img1.id, isMain: true },
    { variantId: ip16V3.id, imageId: ip16Img1.id, isMain: true },
  ]);

  await db.insert(variant_attribute_values).values([
    { variantId: ip16V1.id, attributeId: phoneStorage.id, optionId: opt128.id },
    { variantId: ip16V1.id, attributeId: phoneColor.id, optionId: optDen.id },
    { variantId: ip16V2.id, attributeId: phoneStorage.id, optionId: opt256.id },
    { variantId: ip16V2.id, attributeId: phoneColor.id, optionId: optTrang.id },
    { variantId: ip16V3.id, attributeId: phoneStorage.id, optionId: opt512.id },
    { variantId: ip16V3.id, attributeId: phoneColor.id, optionId: optVangHong.id },
  ]);

  console.log('✅ All 20 products seeded successfully!');
  console.log('');
  console.log('📦 Summary:');
  console.log('   • 3 root categories  (Điện thoại, Máy tính, Phụ kiện)');
  console.log('   • 10 leaf categories (Apple/Samsung/Xiaomi/OPPO phones, Apple/Samsung tablets, Gaming/Office laptops, Headphones, Mouse&Keyboard)');
  console.log('   • 7 brands           (Apple, Samsung, Xiaomi, OPPO, Dell, ASUS, Logitech)');
  console.log('   • 20 products        with variants, images, and attribute values');

  await client.end();
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});