import type { Intervention } from '../types';

// TODO: Replace rule-based recommendations with ML model / LLM endpoint

type RuleCheck = {
  label: string;
  pass: boolean;
  severity: 'success' | 'warning' | 'danger';
};

export function evaluateIntervention(intervention: Intervention): RuleCheck[] {
  const checks: RuleCheck[] = [];

  const cond = intervention.condition;
  if (cond === 'Excellent' || cond === 'Good') {
    checks.push({ label: 'Structure condition is good', pass: true, severity: 'success' });
  } else if (cond === 'Moderate') {
    checks.push({ label: 'Structure condition is moderate', pass: true, severity: 'warning' });
  } else {
    checks.push({ label: 'Structure condition is poor', pass: false, severity: 'danger' });
  }

  const ndviDelta = intervention.ndviAfter - intervention.ndviBefore;
  if (ndviDelta > 0.08) {
    checks.push({ label: 'Vegetation response is positive', pass: true, severity: 'success' });
  } else if (ndviDelta >= 0) {
    checks.push({ label: 'Vegetation response is marginal', pass: true, severity: 'warning' });
  } else {
    checks.push({ label: 'NDVI declining', pass: false, severity: 'danger' });
  }

  const ndwiDelta = intervention.ndwiAfter - intervention.ndwiBefore;
  const waterTypes = ['Check Dam', 'Farm Pond'];
  if (waterTypes.includes(intervention.type)) {
    if (intervention.waterPresent && (intervention.waterAreaAfter > intervention.waterAreaBefore)) {
      checks.push({ label: 'Water indicator improved', pass: true, severity: 'success' });
    } else if (ndwiDelta >= 0) {
      checks.push({ label: 'Water indicator stable', pass: true, severity: 'warning' });
    } else {
      checks.push({ label: 'NDWI declining', pass: false, severity: 'danger' });
    }
  } else {
    if (ndviDelta > 0.05) {
      checks.push({ label: 'Land cover response positive', pass: true, severity: 'success' });
    } else if (ndviDelta >= 0) {
      checks.push({ label: 'Land cover stable', pass: true, severity: 'warning' });
    } else {
      checks.push({ label: 'Land cover declining', pass: false, severity: 'danger' });
    }
  }

  if (intervention.confidence >= 80) {
    checks.push({ label: 'AI interpretation confidence is high', pass: true, severity: 'success' });
  } else if (intervention.confidence >= 60) {
    checks.push({ label: 'AI confidence is moderate', pass: true, severity: 'warning' });
  } else {
    checks.push({ label: 'AI confidence is low — verify in field', pass: false, severity: 'warning' });
  }

  if (intervention.rainfallChange >= 5) {
    checks.push({ label: 'Rainfall context is favorable', pass: true, severity: 'success' });
  } else if (intervention.rainfallChange >= -3) {
    checks.push({ label: 'Rainfall context neutral', pass: true, severity: 'warning' });
  } else {
    checks.push({ label: 'Below-average rainfall may confound results', pass: false, severity: 'warning' });
  }

  return checks;
}

export function generateRecommendation(intervention: Intervention): string {
  const checks = evaluateIntervention(intervention);
  const failures = checks.filter((c) => !c.pass).length;
  const dangers = checks.filter((c) => c.severity === 'danger').length;

  if (dangers >= 2) {
    return 'Prioritize field verification and inspect the structure for damage or siltation. Recommend structural audit and immediate remediation works.';
  }

  if (intervention.condition === 'Poor') {
    return 'Prioritize field verification and inspect the structure for damage or siltation.';
  }

  if (failures >= 2) {
    return 'Schedule detailed field assessment within 30 days. Review maintenance logs and consider targeted repairs or desilting before next monsoon.';
  }

  if (intervention.condition === 'Moderate') {
    if (intervention.type === 'Check Dam' || intervention.type === 'Farm Pond') {
      return 'Schedule desilting and minor repairs in the next dry season to restore full design capacity.';
    }
    return 'Plan supplementary maintenance: gap filling (plantations) or reshaping (trenches) during next operational window.';
  }

  if (intervention.impactScore >= 85) {
    return 'Outstanding performance. Continue current maintenance schedule and consider as a demonstration site for knowledge sharing.';
  }

  if (intervention.impactScore >= 70) {
    return 'Continue periodic monitoring. No immediate intervention required.';
  }

  return 'Continue current monitoring cadence. Reassess after next season field survey and satellite pass.';
}
