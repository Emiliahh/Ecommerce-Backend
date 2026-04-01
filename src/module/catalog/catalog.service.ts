import {
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { type DB, DRIZZLE } from 'src/database/dizzle.provider';
import { CreateCategoryDto } from './dto/create-category.dto';
import {
  attribute_groups,
  attribute_options,
  attributes,
  categories,
} from 'src/database/schema';
import { and, asc, desc, eq, ilike, isNull, lte, sql, SQL, inArray, InferSelectModel } from 'drizzle-orm';
import UpdateCategoryDto from './dto/update-category.dto';
import { CategoryWithAttributeGroupsDto } from './dto/get-attribute.dto';
import { GetCategoryFilterDto } from './dto/get-category-filter.dto';
import {
  CreateAttributeGroupDto,
  UpdateAttributeGroupDto,
  CreateAttributeDto,
  UpdateAttributeDto,
  CreateAttributeOptionDto,
  UpdateAttributeOptionDto,
} from './dto/attribute.dto';
import generateSlug from 'src/util/slugtify';
import { CacheRegistry } from 'src/cache/cache.registry';
import { CategoryTreeResponseDto, GetCategoryDetailResponseDto } from './dto/get-categort.dto';
@Injectable()
export class CatalogService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: DB,
    private readonly cacheRegistry: CacheRegistry,
  ) { }
  async createCategory(dto: CreateCategoryDto) {
    const newCategory = await this.db.transaction(async (tx) => {
      const slug = generateSlug(dto.name)
      // check if slug is already exists
      const [existingCategory] = await tx
        .select()
        .from(categories)
        .where(eq(categories.slug, slug))
        .limit(1);
      if (existingCategory) {
        throw new ConflictException('Slug already exists');
      }
      const parentCategory = dto.parentId ? await tx.query.categories.findFirst({
        where: eq(categories.id, dto.parentId),
      }) : null;
      if (dto.parentId && !parentCategory) {
        throw new NotFoundException('Parent category not found');
      }
      const [newCatgory] = await tx
        .insert(categories)
        .values({
          name: dto.name,
          slug,
          parentId: dto.parentId,
          level: parentCategory?.level ? parentCategory.level + 1 : 0,
        })
        .returning();
      if (dto?.attribute_groups?.length) {
        for (const group of dto.attribute_groups) {
          const [newGroup] = await tx
            .insert(attribute_groups)
            .values({
              name: group.name,
              categoryId: newCatgory.id,
            })
            .returning();

          if (group.attributes?.length) {
            for (const attr of group.attributes) {
              const [newAttr] = await tx
                .insert(attributes)
                .values({
                  name: attr.name,
                  slug: generateSlug(attr.name),
                  type: attr.type,
                  filterable: attr.filterable,
                  unit: attr.unit,
                  groupId: newGroup.id,
                })
                .returning();

              if (attr.options?.length) {
                const optionValues = attr.options.map((opt) => ({
                  value: opt.value,
                  slug: generateSlug(opt.value),
                  attributeId: newAttr.id,
                }));
                await tx.insert(attribute_options).values(optionValues);
              }
            }
          }
        }
      }
      return newCatgory;
    });

    await this.cacheRegistry.reloadCategories();
    return newCategory;
  }
  async updateCategory(dto: UpdateCategoryDto, id: string) {
    try {
      const [updatedCategory] = await this.db
        .update(categories)
        .set({
          name: dto.name,
          slug: dto.slug,
          parentId: dto.parentId,
          updatedAt: new Date(),
        })
        .where(eq(categories.id, id))
        .returning();

      if (!updatedCategory) {
        throw new NotFoundException('Category not found');
      }

      await this.cacheRegistry.reloadCategories();
      return updatedCategory;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(error.message || 'Update failed');
    }
  }
  async deleteCategory(id: string) {
    try {
      const [deletedCategory] = await this.db
        .update(categories)
        .set({ isDeleted: true })
        .where(eq(categories.id, id))
        .returning();

      if (!deletedCategory) {
        throw new NotFoundException('Category not found');
      }

      await this.cacheRegistry.reloadCategories();
      return deletedCategory;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(error.message);
    }
  }
  async getAttribute(
    id: string,
  ): Promise<CategoryWithAttributeGroupsDto | undefined> {
    try {
      const data = await this.db.query.categories.findFirst({
        where: eq(categories.id, id),
        with: {
          attributeGroups: {
            with: {
              attributes: {
                with: {
                  options: true,
                },
              },
            },
          },
        },
      });
      return data as any;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }
  async getAllCategory(filter: GetCategoryFilterDto) {
    try {
      // Build where conditions
      const conditions: SQL[] = [eq(categories.isDeleted, false)];

      if (filter.q) {
        conditions.push(ilike(categories.name, `%${filter.q}%`));
      }

      if (filter.parentId) {
        conditions.push(eq(categories.parentId, filter.parentId));
      }

      if (filter.rootOnly) {
        conditions.push(isNull(categories.parentId));
      }
      if (filter.maxDepth) {
        conditions.push(lte(categories.level, filter.maxDepth))
      }

      const whereClause = and(...conditions);

      // Build sort
      const sortColumn = categories[filter.sortBy];
      const orderByClause =
        filter.sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);

      // Count total
      const [{ count: total }] = await this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(categories)
        .where(whereClause);

      // Fetch data
      const data = await this.db.query.categories.findMany({
        where: whereClause,
        orderBy: orderByClause,
        offset: filter.offset,
        limit: filter.limit,
        with: filter.includeAttributes
          ? {
            attributeGroups: {
              with: {
                attributes: {
                  with: {
                    options: true,
                  },
                },
              },
            },
          }
          : undefined,
      });

      return { count: total, data };
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  // ────────────────────────────────────────────────────────────────
  // ATTRIBUTE GROUPS
  // ────────────────────────────────────────────────────────────────
  async createAttributeGroup(categoryId: string, dto: CreateAttributeGroupDto) {
    try {
      const [newGroup] = await this.db
        .insert(attribute_groups)
        .values({
          name: dto.name,
          categoryId,
        })
        .returning();

      await this.cacheRegistry.reloadCategories();
      return newGroup;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async updateAttributeGroup(id: string, dto: UpdateAttributeGroupDto) {
    try {
      const [updatedGroup] = await this.db
        .update(attribute_groups)
        .set({
          name: dto.name,
        })
        .where(eq(attribute_groups.id, id))
        .returning();

      if (!updatedGroup) throw new NotFoundException('Attribute group not found');

      await this.cacheRegistry.reloadCategories();
      return updatedGroup;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(error.message);
    }
  }

  async deleteAttributeGroup(id: string) {
    try {
      const result = await this.db.transaction(async (tx) => {
        // Delete related attributes and options due to lack of CASCADE on groupId
        const attrs = await tx
          .select({ id: attributes.id })
          .from(attributes)
          .where(eq(attributes.groupId, id));

        if (attrs.length > 0) {
          const attrIds = attrs.map((a) => a.id);
          // Delete Options
          await tx
            .delete(attribute_options)
            .where(inArray(attribute_options.attributeId, attrIds));
          // Delete Attributes
          await tx
            .delete(attributes)
            .where(eq(attributes.groupId, id));
        }

        const [deletedGroup] = await tx
          .delete(attribute_groups)
          .where(eq(attribute_groups.id, id))
          .returning();

        return deletedGroup;
      });

      if (!result) throw new NotFoundException('Attribute group not found');

      await this.cacheRegistry.reloadCategories();
      return result;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(error.message);
    }
  }

  // ────────────────────────────────────────────────────────────────
  // ATTRIBUTES
  // ────────────────────────────────────────────────────────────────
  async createAttribute(groupId: string, dto: CreateAttributeDto) {
    try {
      const [newAttr] = await this.db
        .insert(attributes)
        .values({
          name: dto.name,
          slug: generateSlug(dto.name),
          type: dto.type,
          filterable: dto.filterable,
          unit: dto.unit,
          sortOrder: dto.sortOrder,
          groupId,
        })
        .returning();

      await this.cacheRegistry.reloadCategories();
      return newAttr;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async updateAttribute(id: string, dto: UpdateAttributeDto) {
    try {
      const values: any = { ...dto };
      if (dto.name !== undefined) {
        values.slug = generateSlug(dto.name);
      }

      const [updatedAttr] = await this.db
        .update(attributes)
        .set(values)
        .where(eq(attributes.id, id))
        .returning();

      if (!updatedAttr) throw new NotFoundException('Attribute not found');

      await this.cacheRegistry.reloadCategories();
      return updatedAttr;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(error.message);
    }
  }

  async deleteAttribute(id: string) {
    try {
      const result = await this.db.transaction(async (tx) => {
        // Delete options first to avoid FK constraint issues
        await tx
          .delete(attribute_options)
          .where(eq(attribute_options.attributeId, id));

        const [deletedAttr] = await tx
          .delete(attributes)
          .where(eq(attributes.id, id))
          .returning();

        return deletedAttr;
      });

      if (!result) throw new NotFoundException('Attribute not found');

      await this.cacheRegistry.reloadCategories();
      return result;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(error.message);
    }
  }

  // ────────────────────────────────────────────────────────────────
  // ATTRIBUTE OPTIONS
  // ────────────────────────────────────────────────────────────────
  async createAttributeOption(attributeId: string, dto: CreateAttributeOptionDto) {
    try {
      const [newOption] = await this.db
        .insert(attribute_options)
        .values({
          value: dto.value,
          slug: generateSlug(dto.value),
          attributeId,
        })
        .returning();

      await this.cacheRegistry.reloadCategories();
      return newOption;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async updateAttributeOption(id: string, dto: UpdateAttributeOptionDto) {
    try {
      const values: any = {};
      if (dto.value !== undefined) {
        values.value = dto.value;
        values.slug = generateSlug(dto.value);
      }

      const [updatedOption] = await this.db
        .update(attribute_options)
        .set(values)
        .where(eq(attribute_options.id, id))
        .returning();

      if (!updatedOption) throw new NotFoundException('Attribute option not found');

      await this.cacheRegistry.reloadCategories();
      return updatedOption;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(error.message);
    }
  }

  async deleteAttributeOption(id: string) {
    try {
      const [deletedOption] = await this.db
        .delete(attribute_options)
        .where(eq(attribute_options.id, id))
        .returning();

      if (!deletedOption) throw new NotFoundException('Attribute option not found');

      await this.cacheRegistry.reloadCategories();
      return deletedOption;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(error.message);
    }
  }
  async getCategoryDetail(id: string): Promise<GetCategoryDetailResponseDto> {
    try {
      const data = await this.db.query.categories.findFirst({
        where: eq(categories.id, id),
        with: {
          attributeGroups: {
            with: {
              attributes: {
                with: {
                  options: true,
                },
              },
            },
          },
        },
      });
      return data as any;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }
  async buildTree(): Promise<CategoryTreeResponseDto[]> {
    const items = await this.db.query.categories.findMany()
    const map = new Map<string, CategoryTreeResponseDto>()
    items.forEach((e) => {
      map.set(e.id, {
        label: e.name,
        value: e.id,
        image: e.image,
        level: e.level || 0,
        slug: e.slug,
        children: [],
      })
    })
    items.filter((e) => e.parentId).forEach((e) => {
      const parent = map.get(e.parentId!)
      if (parent) {
        const childNode = map.get(e.id)
        if (childNode) {
          parent.children.push(childNode)
        }
      }
    })
    return items.filter((e) => !e.parentId).map((e) => map.get(e.id)!)
  }
}
