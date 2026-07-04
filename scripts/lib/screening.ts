/**
 * Advisory-only screening flags — never eliminates jobs by themselves.
 * Skill: `.cursor/skills/job-aggregators/references/elimination-rules.md`
 */
export function isHourlyCompensation(text: string): boolean {
  return /\$\d+(?:\.\d{2})?\s*(?:\/\s*hr|per\s+hour|hourly)/i.test(text);
}

export function screeningSignals(title: string, description = ""): string[] {
  const combined = `${title} ${description}`;
  const flags: string[] = [];
  if (/\b(senior|staff|principal|lead|sr\.?)\b/i.test(title)) flags.push("senior-title");
  if (/\b(director|vp|head of|manager)\b/i.test(title)) flags.push("leadership-title");
  if (/\b(unpaid|volunteer|no salary|stipend only)\b/i.test(combined)) flags.push("possibly-unpaid");
  if (isHourlyCompensation(combined)) flags.push("hourly-comp");
  const nonTech = /\b(finance analyst|marketing coordinator|sales representative|sales manager|regional sales|account executive|operations manager|recruiter)\b/i;
  const hasSoftware = /\b(software|engineer|developer|ai|ml|llm|agent|data|automation)\b/i;
  if (nonTech.test(combined) && !hasSoftware.test(combined)) flags.push("possible-non-tech");
  return flags;
}
