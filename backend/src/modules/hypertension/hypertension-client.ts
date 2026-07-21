import type { HealthContext } from "../../config/schemas-v2.js";
import { evaluateFastApiModule } from "../diabetes/diabetes-client.js";

export const evaluateHypertension = (context: HealthContext) =>
  evaluateFastApiModule(
    "/v1/modules/hypertension/evaluate",
    "hypertension-screening-awareness",
    context,
  );
