export function formatApplicantId(id: number | string): string {
  return `EXM-${String(id).padStart(4, '0')}`;
}
