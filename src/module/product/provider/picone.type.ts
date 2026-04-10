import { Pinecone, Index, RecordMetadata } from "@pinecone-database/pinecone";

export interface ProductVectorMetadata {
    productId: string;
    variantId: string;
    name: string;          
    productName: string;
    slug: string;
    categoryId: string;
    brandId: string;
    price: number;
    salePrice: number;
    stock: number;
    sku: string;
    attributes: string;     
    isDeleted: boolean;
}

export type PineconeIndex = Index<ProductVectorMetadata & RecordMetadata>;