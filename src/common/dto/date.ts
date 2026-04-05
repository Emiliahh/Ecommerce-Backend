import z from "zod";

export const dateStr = z.preprocess(
    (v) => (v instanceof Date ? v.toISOString() : v),
    z.string(),
);
