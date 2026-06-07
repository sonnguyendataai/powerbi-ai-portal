import { z } from "zod";

export const effectiveIdentitySchema = z.object({
  username: z.string().min(1),
  datasets: z.array(z.string().min(1)).min(1).max(10),
  roles: z.array(z.string().min(1)).min(1).max(50),
  customData: z.string().max(1024).optional(),
});

export const embedRequestSchema = z.object({
  reportId: z.string().min(1),
  workspaceId: z.string().min(1),
  datasetId: z.string().min(1),
  identities: z.array(effectiveIdentitySchema).max(5).optional(),
  accessLevel: z.enum(["View", "Edit", "Create"]).default("View"),
});

export type EffectiveIdentity = z.infer<typeof effectiveIdentitySchema>;
export type EmbedRequest = z.infer<typeof embedRequestSchema>;

export interface EmbedBundle {
  reportId: string;
  workspaceId: string;
  datasetId: string;
  embedUrl: string;
  embedToken: string;
  expiresAt: string;
}
