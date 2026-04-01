import { z } from "zod";

export const booleanString = z
    .enum(['true', 'false'])
    .transform((val) => val === 'true');