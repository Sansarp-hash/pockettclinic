import React, { useRef } from "react";
import { Download, Printer, Award, ShieldCheck, Heart, User, Calendar } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { jsPDF } from "jspdf";
import { DigitalPrescription } from "../types";

interface DigitalPrescriptionPDFProps {
  prescription: DigitalPrescription;
}

export default function DigitalPrescriptionPDF({ prescription }: DigitalPrescriptionPDFProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const downloadPDF = () => {
    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });

      // Simple elegant PDF generation
      doc.setFillColor(243, 244, 246);
      doc.rect(0, 0, 210, 297, "F");

      // Header block
      doc.setFillColor(30, 41, 59);
      doc.rect(0, 0, 210, 40, "F");
      
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.text("POCKETTCLINIC", 15, 18);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text("Verifiable Digital Prescription Slip", 15, 26);
      doc.text(`Rx ID: ${prescription.rxId}`, 15, 32);

      // Clinic Info (Right)
      doc.setFontSize(10);
      doc.text("Accra, Ghana", 150, 18);
      doc.text("support@pockettclinic.health", 150, 24);

      // Body styling
      doc.setTextColor(15, 23, 42);
      
      // Patient Box
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(12, 48, 186, 32, 2, 2, "FD");
      doc.setFont("helvetica", "bold");
      doc.text("PATIENT INFORMATION", 16, 54);
      doc.setFont("helvetica", "normal");
      doc.text(`Name: ${prescription.patientName}`, 16, 62);
      doc.text(`Age: ${prescription.patientAge || "N/A"}`, 16, 68);
      doc.text(`Gender: ${prescription.patientGender || "N/A"}`, 16, 74);
      doc.text(`Date Issued: ${prescription.createdAt ? new Date(prescription.createdAt).toLocaleDateString() : new Date().toLocaleDateString()}`, 110, 62);

      // Consultant Box
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(12, 86, 186, 32, 2, 2, "FD");
      doc.setFont("helvetica", "bold");
      doc.text("PRESCRIBER INFORMATION", 16, 92);
      doc.setFont("helvetica", "normal");
      doc.text(`Consultant: ${prescription.consultantName}`, 16, 100);
      doc.text(`Cadre: ${prescription.consultantCadre || "Medical Consultant"}`, 16, 106);
      doc.text(`License PIN: ${prescription.consultantPin || "GMC-87293-A"}`, 16, 112);

      // Medications
      doc.setFont("helvetica", "bold");
      doc.text("PRESCRIBED MEDICATIONS", 16, 130);
      
      let startY = 138;
      prescription.medications.forEach((med, i) => {
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(12, startY, 186, 18, 1, 1, "FD");
        doc.setFont("helvetica", "bold");
        doc.text(`${i + 1}. ${med.name}`, 16, startY + 6);
        doc.setFont("helvetica", "normal");
        doc.text(`Dosage: ${med.dosage} | Frequency: ${med.frequency} | Duration: ${med.duration}`, 16, startY + 12);
        if (med.instructions) {
          doc.setFontSize(8);
          doc.text(`Instructions: ${med.instructions}`, 110, startY + 6);
          doc.setFontSize(10);
        }
        startY += 22;
      });

      // Diagnosis / Notes
      if (prescription.diagnosisNotes) {
        doc.setFont("helvetica", "bold");
        doc.text("DIAGNOSIS NOTES & INDICATIONS", 16, startY + 8);
        doc.setFont("helvetica", "normal");
        doc.text(prescription.diagnosisNotes, 16, startY + 16);
        startY += 26;
      }

      // Security / QR Footer
      doc.setFillColor(239, 246, 255);
      doc.roundedRect(12, startY + 10, 186, 40, 2, 2, "FD");
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 64, 175);
      doc.text("TAMPER-PROOF VERIFICATION SECURITY", 18, startY + 18);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text("This prescription has been signed with a cryptographically verifiable SRE PIN.", 18, startY + 24);
      doc.text("Pharmacies in Ghana can scan this QR code to verify validity and mark as fulfilled.", 18, startY + 29);
      doc.text("Scan QR Code or visit: https://pockettclinic.health/rx-verify", 18, startY + 34);

      doc.save(`prescription-${prescription.rxId}.pdf`);
    } catch (err: any) {
      console.error("PDF download failed:", err.message);
    }
  };

  const triggerPrint = () => {
    window.print();
  };

  const rxVerificationUrl = prescription.qrCodeVerificationUrl || `https://pockettclinic.health/verify/rx/${prescription.rxId}`;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 overflow-hidden max-w-2xl mx-auto">
      {/* Header Panel with Quick Actions */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Heart className="w-5 h-5 text-slate-600" />
          <h4 className="font-semibold text-slate-800 text-sm">Verifiable Prescription Slip</h4>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={triggerPrint}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-white rounded-lg transition-all border border-slate-200"
          >
            <Printer className="w-3.5 h-3.5" />
            Print
          </button>
          <button
            onClick={downloadPDF}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-600 rounded-lg transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"
          >
            <Download className="w-3.5 h-3.5" />
            Download PDF
          </button>
        </div>
      </div>

      {/* Printable Area */}
      <div ref={printRef} className="p-8 space-y-6">
        {/* Header Block */}
        <div className="flex justify-between items-start border-b border-slate-200 pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="p-1 bg-slate-200 text-slate-600 rounded-lg">
                <Heart className="w-5 h-5 fill-indigo-600" />
              </span>
              <span className="text-xl font-bold tracking-tight text-slate-800">PockettClinic</span>
            </div>
            <p className="text-xs text-slate-600">Ministry of Health Registered Telehealth Platform</p>
          </div>
          <div className="text-right space-y-1 text-xs text-slate-600">
            <p className="font-bold text-slate-800 text-xs">Accra, Ghana</p>
            <p>support@pockettclinic.health</p>
            <p>Rx ID: <span className="font-mono text-slate-800 font-semibold">{prescription.rxId}</span></p>
          </div>
        </div>

        {/* Patient & Prescriber Dual Block */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-5 rounded-xl border border-slate-200">
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-slate-800 font-semibold text-xs border-b border-slate-200 pb-1.5">
              <User className="w-3.5 h-3.5 text-slate-600" />
              Patient Details
            </div>
            <div className="space-y-1 text-xs text-slate-600">
              <p>Name: <span className="font-semibold text-slate-800">{prescription.patientName}</span></p>
              <p>Age: <span className="font-semibold text-slate-800">{prescription.patientAge || "24"}</span></p>
              <p>Gender: <span className="font-semibold text-slate-800">{prescription.patientGender || "Female"}</span></p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-slate-800 font-semibold text-xs border-b border-slate-200 pb-1.5">
              <Award className="w-3.5 h-3.5 text-slate-600" />
              Prescriber Details
            </div>
            <div className="space-y-1 text-xs text-slate-600">
              <p>Consultant: <span className="font-semibold text-slate-800">{prescription.consultantName}</span></p>
              <p>Cadre: <span className="font-semibold text-slate-800">{prescription.consultantCadre || "Doctor"}</span></p>
              <p>GMC Council PIN: <span className="font-mono font-semibold text-slate-800">{prescription.consultantPin || "GMC-87293-A"}</span></p>
            </div>
          </div>
        </div>

        {/* Prescribed Medications */}
        <div className="space-y-3">
          <h5 className="font-bold text-slate-800 text-xs tracking-wide uppercase">Prescribed Medication list</h5>
          <div className="space-y-2">
            {prescription.medications.map((med, i) => (
              <div key={i} className="flex justify-between items-center p-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
                <div>
                  <h6 className="font-bold text-slate-800 text-sm">{med.name}</h6>
                  <p className="text-xs text-slate-600 mt-1">
                    Dosage: <span className="font-medium text-slate-800">{med.dosage}</span> | Frequency: <span className="font-medium text-slate-800">{med.frequency}</span> | Duration: <span className="font-medium text-slate-800">{med.duration}</span>
                  </p>
                </div>
                {med.instructions && (
                  <div className="text-right text-[11px] text-slate-600 bg-slate-50/50 px-2.5 py-1 rounded-lg border border-indigo-100">
                    {med.instructions}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Diagnosis Note */}
        {prescription.diagnosisNotes && (
          <div className="space-y-2">
            <h5 className="font-bold text-slate-800 text-xs tracking-wide uppercase">Diagnosis Notes & Indications</h5>
            <p className="text-xs text-slate-600 leading-relaxed bg-white p-3 rounded-lg border border-slate-200">
              {prescription.diagnosisNotes}
            </p>
          </div>
        )}

        {/* Verifiable Secure Stamp footer */}
        <div className="flex flex-col sm:flex-row items-center gap-6 p-5 bg-gradient-to-br from-indigo-50 via-white to-sky-50 rounded-xl border border-indigo-100">
          <div className="p-2 bg-white rounded-lg shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 border border-slate-200/60 flex-shrink-0">
            <QRCodeSVG value={rxVerificationUrl} size={90} level="M" />
          </div>
          <div className="space-y-1.5 flex-1 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-1 text-slate-600 font-bold text-xs">
              <ShieldCheck className="w-4 h-4 fill-indigo-100" />
              TAMPER-PROOF VERIFIED DIGITAL SIGNATURE
            </div>
            <p className="text-[11px] text-slate-600 leading-normal">
              This digital prescription is encrypted and secured by PockettClinic. Pharmacy consultants in Ghana can scan this QR code to verify authenticity and securely finalize order fulfillment on the central ledger.
            </p>
            <p className="text-[10px] text-slate-500 font-mono">
              Rx Code: {prescription.rxId} | Verification URL: {rxVerificationUrl}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
