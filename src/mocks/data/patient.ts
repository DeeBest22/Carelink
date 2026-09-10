export const vitalsData = [
  { label: 'Heart Rate', value: '72', unit: 'bpm', icon: 'ri-heart-pulse-line' },
  { label: 'Blood Pressure', value: '118/76', unit: 'mmHg', icon: 'ri-heart-line' },
  { label: 'Blood Sugar', value: '94', unit: 'mg/dL', icon: 'ri-drop-line' },
  { label: 'Weight', value: '68', unit: 'kg', icon: 'ri-scales-3-line' },
];

export const testResults = [
  {
    id: '1',
    testName: 'Complete Blood Count',
    category: 'Hematology',
    lab: 'CareLink Diagnostics',
    result: '13.5',
    unit: 'g/dL',
    normalRange: '12.0 - 15.5 g/dL',
    status: 'normal' as const,
    date: '2026-08-20',
  },
  {
    id: '2',
    testName: 'Fasting Blood Glucose',
    category: 'Metabolic',
    lab: 'CareLink Diagnostics',
    result: '94',
    unit: 'mg/dL',
    normalRange: '70 - 99 mg/dL',
    status: 'normal' as const,
    date: '2026-08-15',
  },
  {
    id: '3',
    testName: 'LDL Cholesterol',
    category: 'Lipid Panel',
    lab: 'CareLink Diagnostics',
    result: '142',
    unit: 'mg/dL',
    normalRange: '< 100 mg/dL',
    status: 'high' as const,
    date: '2026-07-30',
  },
];

export const healthTips = [
  { icon: 'ri-run-line', title: 'Stay active', text: 'Aim for 30 minutes of movement today.' },
  { icon: 'ri-cup-line', title: 'Hydrate', text: 'Drink at least 8 glasses of water.' },
  { icon: 'ri-moon-clear-line', title: 'Rest well', text: 'Try to get 7-8 hours of sleep tonight.' },
];
