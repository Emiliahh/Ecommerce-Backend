import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { type DB, DRIZZLE } from 'src/database/dizzle.provider';
import { categories } from 'src/database/schema';

export type CategoryEntity = typeof categories.$inferSelect;

@Injectable()
export class CacheRegistry implements OnModuleInit {
  private readonly logger = new Logger(CacheRegistry.name);

  categoriesById = new Map<string, CategoryEntity>();
  categoriesBySlug = new Map<string, CategoryEntity>();

  constructor(
    @Inject(DRIZZLE)
    private readonly db: DB,
  ) {}

  async onModuleInit() {
    await this.reloadCategories();
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
}
