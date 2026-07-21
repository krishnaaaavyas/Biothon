import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const assessmentSearchSchema = z.object({
  mode: z.string().optional(),
  step: z.number().optional(),
});

export const Route = createFileRoute("/_app/assessment")({
  validateSearch: (search) => assessmentSearchSchema.parse(search),
});
