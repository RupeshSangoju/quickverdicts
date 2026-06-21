// Juror compensation amount and time commitment by case tier

export function getJurorCompensation(caseTier: string): number {
  switch (caseTier?.toLowerCase().trim()) {
    case 'early adopter': return 75;
    case 'tier 1': return 75;
    case 'tier 2': return 105;
    case 'tier 3': return 135;
    default: return 75;
  }
}

export function getJurorCompensationHours(caseTier: string): number {
  switch (caseTier?.toLowerCase().trim()) {
    case 'early adopter': return 2.5;
    case 'tier 1': return 2.5;
    case 'tier 2': return 3.5;
    case 'tier 3': return 4.5;
    default: return 2.5;
  }
}

export function formatJurorCompensation(caseTier: string): string {
  return `$${getJurorCompensation(caseTier)} for ${getJurorCompensationHours(caseTier)} hours`;
}
