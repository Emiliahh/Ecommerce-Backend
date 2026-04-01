import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { type DB, DRIZZLE } from 'src/database/dizzle.provider';
import { categories } from 'src/database/schema';

export type CategoryEntity = typeof categories.$inferSelect;
type CategoryTree = CategoryEntity & {
  children: CategoryTree[];
}
@Injectable()
export class CacheRegistry implements OnModuleInit {
  private readonly logger = new Logger(CacheRegistry.name);

  categoriesById = new Map<string, CategoryEntity>();
  categoriesBySlug = new Map<string, CategoryEntity>();
  categoriesTree = new Map<string, CategoryTree>();
  constructor(
    @Inject(DRIZZLE)
    private readonly db: DB,
  ) { }

  async onModuleInit() {
    await this.reloadCategories();
  }
  buildTree() {
    for (const [key, value] of this.categoriesById) {
      this.categoriesTree.set(key, { ...value, children: [] })
    }
    // iterate over the tree and add children to the parent
    for (const [key, value] of this.categoriesTree) {
      if (value.parentId) {
        const parent = this.categoriesTree.get(value.parentId)
        if (parent) {
          parent.children.push(value)
        }
      }
    }
    for (const [key, value] of this.categoriesTree) {
      if (value.parentId) {
        this.categoriesTree.delete(key)
      }
    }
  }

  async reloadCategories() {
    const rows = await this.db
      .select()
      .from(categories)
      .where(eq(categories.isDeleted, false));

    this.categoriesById.clear();
    this.categoriesBySlug.clear();

    for (const category of rows) {
      this.categoriesById.set(category.id, category);
      this.categoriesBySlug.set(category.slug, category);
    }

    this.logger.log(`Loaded ${rows.length} categories into map cache`);
  }

  getCategoryById(id: string) {
    return this.categoriesById.get(id);
  }

  getParentCategoryById(id: string) {
    const category = this.categoriesById.get(id);
    if (!category?.parentId) {
      return null;
    }
    return this.categoriesById.get(category.parentId) ?? null;
  }
  getAllDescendants(id: string): CategoryEntity[] {
    const root = this.categoriesById.get(id);
    if (!root) return [];

    const result: CategoryEntity[] = [];
    const allCategories = Array.from(this.categoriesById.values());

    const gather = (parentId: string) => {
      const children = allCategories.filter((c) => c.parentId === parentId);
      for (const child of children) {
        result.push(child);
        gather(child.id);
      }
    };

    gather(root.id);
    return result;
  }
}
