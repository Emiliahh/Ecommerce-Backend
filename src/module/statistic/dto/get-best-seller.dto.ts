import { createZodDto } from "nestjs-zod";
import z from "zod";

const productQuerySchema = z.object({
    category: z.string().optional(),
    offset: z.coerce.number().optional().default(0),
    startDate: z.string().optional().transform((val) => val ? new Date(val) : undefined),
    endDate: z.string().optional().transform((val) => val ? new Date(val) : undefined),
    limit: z.coerce.number().optional().default(10),
});
export default class GetBestSellerQuery extends createZodDto(productQuerySchema) { }