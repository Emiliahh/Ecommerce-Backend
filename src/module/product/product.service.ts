import {
  BadRequestException,
  HttpException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  and,
  count,
  exists,
  gte,
  ilike,
  InferInsertModel,
  notInArray,
  or,
  sql,
  lte,
  eq,
  inArray,
  SQL,
} from 'drizzle-orm';
import { DRIZZLE, type DB } from 'src/database/dizzle.provider';
import {
  products,
  product_variants,
  product_images,
  categories,
  variant_images,
  product_attribute_values,
  attributes,
  attribute_options,
  variant_attribute_values,
  attribute_groups,
  discount_events,
  discount_event_products,
} from 'src/database/schema';
import { CreateProductDto } from './dto/create-product.dto';
import GetProductResponseDto, {
  PaginatedGetProductListResponseDto,
  ProductQueryDto,
} from './dto/get-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CacheRegistry } from 'src/cache/cache.registry';
import { PromotionService } from '../promotion/promotion.service';

@Injectable()
export class ProductService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DB,
    private readonly promotionService: PromotionService,
    private readonly cache: CacheRegistry,
  ) {}

  async create(dto: CreateProductDto) {
    // Check if category exists
    const categoryExists = await this.db.query.categories.findFirst({
      where: eq(categories.id, dto.categoryId),
    });

    if (!categoryExists) {
      throw new NotFoundException(
        `Category with ID ${dto.categoryId} not found`,
      );
    }

    return await this.db.transaction(async (tx) => {
      const [newProduct] = await tx
        .insert(products)
        .values({
          categoryId: dto.categoryId,
          name: dto.name,
          description: dto.description,
          slug: this.generateSlug(dto.name),
          seoMetadata: dto.seoMetadata,
        })
        .returning();
      const uniqueUrls = new Set<string>();
      const productImagesToInsert: {
        productId: string;
        url: string;
        isMain: boolean;
        sortOrder: number;
        publicId: string | null;
        secureUrl: string | null;
      }[] = [];
      let sortCounter = 0;
      if (dto.images) {
        for (const url of dto.images) {
          if (!uniqueUrls.has(url.url)) {
            uniqueUrls.add(url.url);
            productImagesToInsert.push({
              productId: newProduct.id,
              url: url.url,
              isMain: sortCounter === 0,
              publicId: url.publicId || null,
              secureUrl: url.secureUrl || null,
              sortOrder: sortCounter++,
            });
          }
        }
      }
      const [baseVariant] = await tx
        .insert(product_variants)
        .values({
          productId: newProduct.id,
          sku: dto.sku ?? '',
          price: dto.price ?? 0,
          stock: dto.stock,
          name: dto.name,
        })
        .returning();
      if (dto.attribute?.length) {
        const attributeValuesToInsert = dto.attribute.map((attr) => {
          return {
            productId: newProduct.id,
            attributeId: attr.attributeId,
            value: attr.value,
            optionId: attr.optionId,
          };
        });
        await tx
          .insert(product_attribute_values)
          .values(attributeValuesToInsert);
      }

      // Insert distinct images and map URLs to their generated IDs
      const urlToImageId = new Map<string, string>();
      if (productImagesToInsert.length > 0) {
        const insertedImages = await tx
          .insert(product_images)
          .values(productImagesToInsert)
          .returning();
        insertedImages.forEach((img) => urlToImageId.set(img.url, img.id));
      }

      if (dto.variants) {
        for (const variantDto of dto.variants) {
          const [newVariant] = await tx
            .insert(product_variants)
            .values({
              productId: newProduct.id,
              sku: variantDto.sku,
              price: variantDto.price,
              stock: variantDto.stock,
              name: variantDto.name,
            })
            .returning();

          // Link each specific variant to its own subset of images
          if (variantDto.images && variantDto.images.length > 0) {
            const variantImagesToInsert = variantDto.images.map(
              (url, index) => {
                const imageId = urlToImageId.get(url);
                if (!imageId)
                  throw new InternalServerErrorException(
                    `Image ID not found for URL: ${url}`,
                  );
                return {
                  variantId: newVariant.id,
                  imageId: imageId,
                  isMain: index === 0,
                };
              },
            );

            await tx.insert(variant_images).values(variantImagesToInsert);
          }
        }
      }
      if (urlToImageId.size > 0) {
        const baseVariantImages = Array.from(urlToImageId.values()).map(
          (imageId, index) => ({
            variantId: baseVariant.id,
            imageId,
            isMain: index === 0,
          }),
        );
        await tx.insert(variant_images).values(baseVariantImages);
      }
      return {
        id: newProduct.id,
        slug: newProduct.slug,
        message: 'Product created successfully',
      };
    });
  }
  // plain get product detail without mapping
  async getProductDetail(product_id: string) {
    const product = await this.db.query.products.findFirst({
      where:
        product_id.length == 36
          ? eq(products.id, product_id)
          : eq(products.slug, product_id),
      with: {
        category: {
          columns: {
            slug: true,
          },
        },
        variants: {
          with: {
            variantImages: {
              with: {
                image: {
                  columns: {
                    id: true,
                    url: true,
                  },
                },
              },
            },
            attributeValues: {
              with: {
                option: true,
                attribute: {
                  with: {
                    group: true,
                  },
                },
              },
            },
          },
        },
        images: true,
        attributeValues: {
          with: {
            option: true,
            attribute: {
              with: {
                group: true,
              },
            },
          },
        },
        discountEvents: {
          with: {
            event: true,
          },
        },
      },
    });
    if (!product) {
      throw new NotFoundException(`Product not found`);
    }
    return product;
  }

  async getProductOption(product_id: string) {
    const optionsData = await this.db
      .select({
        optionValue: attribute_options.value,
        optionId: attribute_options.id,
        attributeName: attributes.name,
        attributeId: attributes.id,
        type: attributes.type,
        filterable: attributes.filterable,
        unit: attributes.unit,
        sortOrder: attributes.sortOrder,
        groupId: attribute_groups.id,
        groupName: attribute_groups.name,
      })
      .from(attributes)
      .innerJoin(attribute_groups, eq(attributes.groupId, attribute_groups.id))
      .innerJoin(
        attribute_options,
        eq(attributes.id, attribute_options.attributeId),
      )
      .innerJoin(
        variant_attribute_values,
        and(
          eq(variant_attribute_values.attributeId, attributes.id),
          eq(variant_attribute_values.optionId, attribute_options.id),
        ),
      )
      .innerJoin(
        product_variants,
        eq(variant_attribute_values.variantId, product_variants.id),
      )
      .where(
        and(
          eq(product_variants.productId, product_id),
          eq(attributes.isVariant, true),
        ),
      )
      .groupBy(attributes.id, attribute_groups.id, attribute_options.id);

    return optionsData;
  }

  async getProduct(product_id: string): Promise<GetProductResponseDto> {
    try {
      const product = await this.getProductDetail(product_id);
      const [optionsData, variantSale] = await Promise.all([
        this.getProductOption(product.id),
        this.promotionService.getProductVariantWithDiscountPrice(product.id),
      ]);
      const variantPriceMap = new Map<string, (typeof variantSale)[0]>();
      variantSale.forEach((item) => {
        variantPriceMap.set(item.variantId, item);
      });

      const variant_option = optionsData.reduce(
        (acc, curr) => {
          const {
            attributeId,
            attributeName,
            optionId,
            optionValue,
            sortOrder,
          } = curr;
          let attr = acc.find((a) => a.value === attributeId);

          if (!attr) {
            attr = {
              label: attributeName,
              value: attributeId,
              order: sortOrder,
              options: [],
            };
            acc.push(attr);
          }

          if (optionId && optionValue) {
            attr.options.push({
              label: optionValue,
              value: optionId,
            });
          }

          return acc;
        },
        [] as {
          label: string;
          value: string;
          options: { label: string; value: string }[];
          order: number;
        }[],
      );
      const groupedAttributesRecord = product.attributeValues.reduce(
        (acc, curr) => {
          const groupName = curr.attribute?.group?.name || 'Khác';
          if (!acc[groupName]) {
            acc[groupName] = [];
          }

          const attrName = curr.attribute?.name;
          const attrValue = curr.value || curr.option?.value;
          const existingAttr = acc[groupName].find((a) => a.name === attrName);

          if (existingAttr) {
            if (attrValue && !existingAttr.values.includes(attrValue)) {
              existingAttr.values.push(attrValue);
            }
          } else {
            acc[groupName].push({
              name: attrName,
              id: curr.attributeId,
              optionId: curr.optionId,
              values: attrValue ? [attrValue] : [],
              filterable: curr.attribute?.filterable,
              sortOrder: curr.attribute.sortOrder,
              type: curr.attribute.type,
              unit: curr.attribute.unit || undefined,
            });
          }

          return acc;
        },
        {} as Record<
          string,
          {
            name: string | undefined;
            id: string | undefined;
            optionId: string | null | undefined;
            values: string[];
            filterable: boolean | undefined;
            sortOrder: number | undefined;
            type: string | undefined;
            unit: string | undefined;
          }[]
        >,
      );
      const formattedAttributeGroups = Object.entries(
        groupedAttributesRecord,
      ).map(([groupName, attributes]) => ({
        groupName,
        attributes,
      }));
      const { attributeValues, category, ...restProduct } = product;
      const variants = product.variants.map((variant) => {
        const { attributeValues, ...restVariant } = variant;

        const attributes = attributeValues.map((curr) => ({
          attributeId: curr.attributeId,
          optionId: curr.optionId,
          value: curr.value || curr.option?.value || '',
        }));

        const saleData = variantPriceMap.get(variant.id);

        return {
          ...restVariant,
          attributes,
          finalPrice: saleData?.finalPrice ?? variant.price,
          basePrice: variant.price,
          discountPercentage: saleData?.discountPercentage ?? null,
          promoStockLeft: saleData?.promoStockLeft ?? null,
        };
      });

      const categoryPath: { id: string; name: string; slug: string }[] = [];
      let current = this.cache.getCategoryById(product.categoryId);
      while (current) {
        categoryPath.unshift({
          id: current.id,
          name: current.name,
          slug: current.slug,
        });
        current = current.parentId
          ? this.cache.getCategoryById(current.parentId)
          : undefined;
      }

      return {
        ...restProduct,
        categoryPath,
        attributeGroups: formattedAttributeGroups,
        variant_option,
        variants: variants,
      } as GetProductResponseDto;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to fetch product');
    }
  }

  async getAllProduct(
    query: ProductQueryDto,
  ): Promise<PaginatedGetProductListResponseDto> {
    const { offset, limit } = query;
    const [totalCountResult, data] = await Promise.all([
      this.db
        .select({ value: count() })
        .from(products)
        .where(this.buildProductWhereConditions(query)),

      this.db.query.products.findMany({
        where: this.buildProductWhereConditions(query),
        columns: {
          description: false,
        },
        with: {
          category: {
            columns: {
              slug: true,
            },
          },
          variants: {
            columns: {
              price: true,
              sku: true,
            },
          },
          images: {
            columns: {
              url: true,
              isMain: true,
            },
          },
          discountEvents: {
            with: {
              event: true,
            },
          },
        },
        offset,
        limit,
        orderBy: (p, { asc, desc }) => {
          const minPriceSubquery = sql`(
            SELECT MIN("product_variants"."price") 
            FROM "product_variants" 
            WHERE "product_variants"."product_id" = ${p.id}
          )`;

          return [
            query.sort_method === 'asc'
              ? asc(minPriceSubquery)
              : desc(minPriceSubquery),
          ];
        },
      }),
    ]);

    const totalCount = totalCountResult[0]?.value ?? 0;
    const dataWithEvents = data.map(({ category, ...product }) => {
      const now = new Date();
      return {
        ...product,
        categorySlug: category.slug,
        discountEvents: product.discountEvents.filter((de) => {
          const event = de.event;
          if (!event || !event.isActive) return false;
          if (event.startDate > now) return false;
          if (event.endDate && event.endDate < now) return false;
          return true;
        }),
      };
    });

    return {
      count: totalCount,
      //@ts-ignore
      data: dataWithEvents,
    };
  }

  private buildProductWhereConditions(query: ProductQueryDto) {
    const { q, filter, category } = query;
    const conditions: SQL[] = [];

    if (filter && Object.keys(filter).length > 0 && !category) {
      throw new BadRequestException(
        'Category is required when filter is present',
      );
    }

    if (category) {
      const childs = this.cache.getAllDescendants(category);
      const categoryIds = [category, ...childs.map((c) => c.id)];
      conditions.push(
        exists(
          this.db
            .select()
            .from(categories)
            .where(
              and(
                eq(categories.id, products.categoryId),
                inArray(categories.id, categoryIds),
              ),
            ),
        ),
      );
    }

    if (q) {
      const searchCondition = or(ilike(products.name, `%${q}%`));
      if (searchCondition) conditions.push(searchCondition);
    }

    if (filter) {
      Object.entries(filter).forEach(([attributeName, values]) => {
        if (!Array.isArray(values) || values.length === 0) return;

        if (attributeName === 'price') {
          const [minPrice, maxPrice] = values;
          const minPriceNum = Number(minPrice) || 0;
          const maxPriceNum = Number(maxPrice) || 2_147_483_647;
          conditions.push(
            exists(
              this.db
                .select()
                .from(product_variants)
                .where(
                  and(
                    eq(product_variants.productId, products.id),
                    gte(product_variants.price, minPriceNum),
                    lte(product_variants.price, maxPriceNum),
                  ),
                ),
            ),
          );
        } else {
          conditions.push(
            exists(
              this.db
                .select()
                .from(product_attribute_values)
                .innerJoin(
                  attributes,
                  eq(product_attribute_values.attributeId, attributes.id),
                )
                .where(
                  and(
                    eq(product_attribute_values.productId, products.id),
                    eq(attributes.id, attributeName),
                    inArray(
                      product_attribute_values.optionId,
                      values.map((v) => v.toString()),
                    ),
                  ),
                ),
            ),
          );
        }
      });
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  async updateProductTransaction(
    product_id: string,
    updateProductDTO: UpdateProductDto,
  ) {
    return await this.db.transaction(async (tx) => {
      // get snap shot
      const product = await tx.query.products.findFirst({
        where: eq(products.id, product_id),
        with: {
          variants: { with: { attributeValues: true } },
          attributeValues: true,
          images: true,
        },
      });

      if (!product) throw new NotFoundException('Product not found');
      // update base product
      const updateProduct = tx
        .update(products)
        .set({
          name: updateProductDTO.name,
          description: updateProductDTO.description as string | undefined,
          categoryId: updateProductDTO.categoryId,
          seoMetadata: updateProductDTO.seoMetadata,
        })
        .where(eq(products.id, product_id));

      // product attribute values
      let updateAttributes: Promise<any>;
      if (updateProductDTO.attribute !== undefined) {
        updateAttributes = (async () => {
          // brute force update all
          await tx
            .delete(product_attribute_values)
            .where(eq(product_attribute_values.productId, product_id));

          // 2. Insert new attributes (if any)
          if (updateProductDTO.attribute!.length > 0) {
            await tx.insert(product_attribute_values).values(
              updateProductDTO.attribute!.map((attr) => ({
                ...attr,
                productId: product_id,
              })),
            );
          }
        })();
      } else {
        updateAttributes = Promise.resolve();
      }
      // store look up table
      const urlToImageId = new Map<string, string>();

      let updateImages: Promise<any>;
      if (updateProductDTO.images) {
        updateImages = (async () => {
          const incomingUrls = updateProductDTO
            .images!.map((i) => i.url)
            .filter(Boolean);

          if (incomingUrls.length > 0) {
            await tx
              .delete(product_images)
              .where(
                and(
                  eq(product_images.productId, product_id),
                  notInArray(product_images.url, incomingUrls),
                ),
              );
          } else {
            await tx
              .delete(product_images)
              .where(eq(product_images.productId, product_id));
          }

          // Deduplicate by url, preserving order
          const seen = new Set<string>();
          const dedupedImages = updateProductDTO.images!.filter((img) => {
            if (seen.has(img.url)) return false;
            seen.add(img.url);
            return true;
          });

          // Split into updates and inserts upfront to preserve index/sortOrder
          const toUpdate: { img: (typeof dedupedImages)[0]; index: number }[] =
            [];
          const toInsert: (typeof product_images.$inferInsert)[] = [];

          dedupedImages.forEach((img, index) => {
            if (img.id) {
              toUpdate.push({ img, index });
            } else {
              toInsert.push({
                productId: product_id,
                url: img.url,
                isMain: index === 0,
                sortOrder: index,
                publicId: img.publicId ?? null,
                secureUrl: img.secureUrl ?? null,
              });
            }
          });

          await Promise.all([
            ...toUpdate.map(({ img, index }) =>
              tx
                .update(product_images)
                .set({ isMain: index === 0, sortOrder: index })
                .where(
                  and(
                    eq(product_images.id, img.id!),
                    eq(product_images.productId, product_id),
                  ),
                ),
            ),
            toInsert.length > 0
              ? tx.insert(product_images).values(toInsert)
              : Promise.resolve(),
          ]);

          // Build urlToImageId map from remaining images (one select)
          const remaining = await tx
            .select()
            .from(product_images)
            .where(eq(product_images.productId, product_id));

          remaining.forEach((img) => urlToImageId.set(img.url, img.id));
        })();
      } else {
        // if images is undefined no update but only kindle the flame
        updateImages = (async () => {
          const existing = await tx
            .select()
            .from(product_images)
            .where(eq(product_images.productId, product_id));
          existing.forEach((img) => urlToImageId.set(img.url, img.id));
        })();
      }

      // parallel call for faster speed
      await Promise.all([updateProduct, updateAttributes, updateImages]);

      // ─variant
      if (product.variants && updateProductDTO.variants) {
        const originalMap = new Map(product.variants.map((v) => [v.id, v]));
        const incomingIds = new Set(
          updateProductDTO.variants.map((v) => v.id).filter(Boolean),
        );

        // Delete removed variants in one call
        const toDelete = Array.from(originalMap.keys()).filter(
          (id) => !incomingIds.has(id),
        );

        const deleteVariants =
          toDelete.length > 0
            ? tx
                .delete(product_variants)
                .where(inArray(product_variants.id, toDelete))
            : Promise.resolve();

        // Process all variants in parallel
        const processVariants = Promise.all(
          updateProductDTO.variants.map(async (newData) => {
            let variantId: string;

            if (newData.id && originalMap.has(newData.id)) {
              variantId = newData.id;

              const ops: Promise<unknown>[] = [
                tx
                  .update(product_variants)
                  .set({
                    name: newData.name,
                    price: newData.price,
                    sku: newData.sku,
                    stock: newData.stock,
                  })
                  .where(eq(product_variants.id, variantId)),
              ];
              if (newData.attributes !== undefined) {
                const variantAttrSync = async () => {
                  const incomingAttrIds = newData.attributes!.map(
                    (a) => a.attributeId,
                  );

                  // 1. Delete all existing attributes for this variant
                  await tx
                    .delete(variant_attribute_values)
                    .where(eq(variant_attribute_values.variantId, variantId));

                  // 2. Insert new ones (if any)
                  if (newData.attributes!.length > 0) {
                    await tx.insert(variant_attribute_values).values(
                      newData.attributes!.map((attr) => ({
                        variantId,
                        attributeId: attr.attributeId,
                        optionId: attr.optionId,
                        value: attr.value,
                      })),
                    );
                  }
                };

                ops.push(variantAttrSync());
              }

              // Delete old variant images + bulk insert new ones
              if (newData.images !== undefined) {
                ops.push(
                  (async () => {
                    await tx
                      .delete(variant_images)
                      .where(eq(variant_images.variantId, variantId));

                    if (newData.images!.length > 0) {
                      await tx.insert(variant_images).values(
                        newData.images!.map((url, index) => {
                          const imageId = urlToImageId.get(url);
                          if (!imageId)
                            throw new InternalServerErrorException(
                              `Image ID not found for URL: ${url}`,
                            );
                          return { variantId, imageId, isMain: index === 0 };
                        }),
                      );
                    }
                  })(),
                );
              }

              await Promise.all(ops);
            } else {
              // Insert new variant
              const [inserted] = await tx
                .insert(product_variants)
                .values({
                  productId: product_id,
                  name: newData.name,
                  price: newData.price ?? 0,
                  sku: newData.sku ?? '',
                  stock: newData.stock,
                })
                .returning();

              variantId = inserted.id;

              // Bulk insert attributes + images in parallel
              await Promise.all([
                newData.attributes?.length
                  ? tx.insert(variant_attribute_values).values(
                      newData.attributes.map((attr) => ({
                        variantId,
                        attributeId: attr.attributeId,
                        optionId: attr.optionId,
                        value: attr.value,
                      })),
                    )
                  : Promise.resolve(),

                newData.images?.length
                  ? tx.insert(variant_images).values(
                      newData.images.map((url, index) => {
                        const imageId = urlToImageId.get(url);
                        if (!imageId)
                          throw new InternalServerErrorException(
                            `Image ID not found for URL: ${url}`,
                          );
                        return { variantId, imageId, isMain: index === 0 };
                      }),
                    )
                  : Promise.resolve(),
              ]);
            }
          }),
        );

        await Promise.all([deleteVariants, processVariants]);
      }

      return { message: 'Product updated successfully' };
    });
  }
  async deleteProduct(id) {
    await this.db.transaction(async (tx) => {
      await tx
        .delete(product_variants)
        .where(eq(product_variants.productId, id));
      await tx.delete(product_images).where(eq(product_images.productId, id));
      await tx
        .delete(product_attribute_values)
        .where(eq(product_attribute_values.productId, id));
      await tx.delete(products).where(eq(products.id, id));
    });
  }
  
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
  }
  
}
