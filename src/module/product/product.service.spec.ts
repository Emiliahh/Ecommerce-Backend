import { Test, TestingModule } from '@nestjs/testing';
import { ProductService } from './product.service';
import { DRIZZLE } from 'src/database/dizzle.provider';
import { productsRelations } from 'src/database/schema';

describe('ProductService', () => {
  let service: ProductService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductService,
        {
          provide: DRIZZLE,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<ProductService>(ProductService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
