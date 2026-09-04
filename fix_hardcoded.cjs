const fs = require('fs');

const replacements = [
  { file: 'src/components/admin/AdminPlatformAnalyticsExport.tsx', search: "useState('2026-08')", replace: "useState('')" },
  { file: 'src/components/admin/TicketingManagement.tsx', search: "useState('Network Interruption Credit')", replace: "useState('')" },
  { file: 'src/components/admin/TicketingManagement.tsx', search: "useState('50')", replace: "useState('')" },
  { file: 'src/components/admin/AdminPartnerPharmacyManager.tsx', search: "useState('Greater Accra')", replace: "useState('')" },
  { file: 'src/components/admin/AdminPartnerPharmacyManager.tsx', search: "useState('Accra')", replace: "useState('')" },
  { file: 'src/components/consultant/ConsultantOnboarding.tsx', search: "useState('GHA-')", replace: "useState('')" },
  { file: 'src/components/consultant/ConsultantOnboarding.tsx', search: "useState('IND-2026-')", replace: "useState('')" },
  { file: 'src/components/consultant/ConsultantOnboarding.tsx', search: "useState('Star Assurance Ghana')", replace: "useState('')" },
  { file: 'src/components/consultant/ConsultantOnboarding.tsx', search: "useState('2027-12-31')", replace: "useState('')" },
  { file: 'src/components/consultant/ConsultantOnboarding.tsx', search: "useState('Monday - Friday')", replace: "useState('')" },
  { file: 'src/components/consultant/ConsultantOnboarding.tsx', search: "useState('9:00 AM - 5:00 PM')", replace: "useState('')" },
  { file: 'src/components/consultant/FollowUpScheduler.tsx', search: "useState('+233 24 000 0000')", replace: "useState('')" },
  { file: 'src/components/consultant/FollowUpScheduler.tsx', search: "useState('Review therapeutic response to prescribed medication')", replace: "useState('')" },
  { file: 'src/components/consultant/ConsultantPayoutHub.tsx', search: "useState('GCB Bank')", replace: "useState('')" },
  { file: 'src/components/patient/MedicationReminderTracker.tsx', search: "useState('Take with food')", replace: "useState('')" },
  { file: 'src/components/patient/FamilyProfilesManager.tsx', search: "useState('O+')", replace: "useState('')" },
  { file: 'src/components/Booking.tsx', search: "useState('General consultation request: Mild fever, sore throat and fatigue for 2 days.')", replace: "useState('')" },
  { file: 'src/components/ConsultantReviewSignatureModal.tsx', search: "useState('Patient presented with acute mild symptoms. Evaluated during 15-minute live virtual consultation session.')", replace: "useState('')" },
  { file: 'src/components/ConsultantReviewSignatureModal.tsx', search: "useState('Hydration, supportive care, and symptomatic OTC medication.')", replace: "useState('')" },
  { file: 'src/components/ConsultantReviewSignatureModal.tsx', search: "useState('Monitor temperature for 24-48 hours. Consult a doctor if symptoms escalate.')", replace: "useState('')" },
  { file: 'src/components/PatientDashboard.tsx', search: "useState('Mild fever and general symptoms for 2 days.')", replace: "useState('')" },
  { file: 'src/components/PatientDashboard.tsx', search: "useState('0244123456')", replace: "useState('')" }
];

for (const r of replacements) {
  if (fs.existsSync(r.file)) {
    let content = fs.readFileSync(r.file, 'utf8');
    content = content.replace(r.search, r.replace);
    fs.writeFileSync(r.file, content);
  }
}
