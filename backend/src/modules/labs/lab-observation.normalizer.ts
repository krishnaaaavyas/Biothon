import type { LabObservation } from "../../config/schemas-v2.js";

export interface NormalizedLabEvidence {
  code: string;
  verificationStatus: LabObservation["verificationStatus"];
  plausibleRangePassed: boolean;
}

export function normalizeLabEvidence(observations: LabObservation[]): NormalizedLabEvidence[] {
  return observations.map((observation) => ({
    code: observation.code.toLowerCase().trim().replace(/[\s-]+/g, "_"),
    verificationStatus: observation.verificationStatus,
    plausibleRangePassed: observation.plausibleRangePassed,
  }));
}
