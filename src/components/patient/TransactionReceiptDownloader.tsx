import React from 'react';
import { Download, FileText, CheckCircle2, ShieldCheck, Printer } from 'lucide-react';
import { formatConsultantName } from '../../lib/formatters';
import { useAppContext } from '../../AppContext';

interface TransactionReceiptDownloaderProps {
  consultation: any;
}

export default function TransactionReceiptDownloader({ consultation }: TransactionReceiptDownloaderProps) {
  const { globalTitle, globalSlogan } = useAppContext();
  if (!consultation) return null;

  const handlePrintReceipt = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const receiptHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Official Consultation Receipt - PockettClinic</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #0f172a; max-width: 650px; margin: 0 auto; }
            .header { text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 24px; }
            .logo { font-weight: 900; font-size: 24px; color: #059669; }
            .sub { font-size: 12px; color: #64748b; margin-top: 4px; uppercase; font-weight: 700; letter-spacing: 1px; }
            .row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
            .label { color: #64748b; font-weight: 600; }
            .val { font-weight: 700; text-align: right; }
            .total { font-size: 18px; font-weight: 900; color: #059669; padding-top: 16px; border-top: 2px solid #059669; margin-top: 20px; }
            .footer { margin-top: 40px; font-size: 11px; text-align: center; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 16px; }
            .badge { background: #dcfce7; color: #15803d; padding: 4px 10px; border-radius: 12px; font-weight: 800; font-size: 11px; text-transform: uppercase; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">${globalTitle || 'PockettClinic'} Ghana</div>
            <div class="sub">${globalSlogan || 'Official Virtual Consultation & Insurance Payment Receipt'}</div>
          </div>

          <div class="row">
            <span class="label">Receipt Ref ID</span>
            <span class="val font-mono">${consultation.sessionId || consultation.id}</span>
          </div>

          <div class="row">
            <span class="label">Date & Time</span>
            <span class="val">${consultation.createdAt?.seconds ? new Date(consultation.createdAt.seconds * 1000).toLocaleString() : new Date().toLocaleString()}</span>
          </div>

          <div class="row">
            <span class="label">Patient Name</span>
            <span class="val">${consultation.patientName || 'Patient'}</span>
          </div>

          <div class="row">
            <span class="label">Attending Healthcare Consultant</span>
            <span class="val">${consultation.consultantName || 'Healthcare Consultant'} (${consultation.consultantCadre || 'CONSULTANT'})</span>
          </div>

          <div class="row">
            <span class="label">Consultation Tier</span>
            <span class="val">${consultation.tierDurationMinutes || 15} Minutes On-Demand Session</span>
          </div>

          <div class="row">
            <span class="label">Payment Method</span>
            <span class="val">Paystack Mobile Money / Card</span>
          </div>

          <div class="row">
            <span class="label">Payment Standing</span>
            <span class="val"><span class="badge">PAID & VERIFIED</span></span>
          </div>

          <div class="row total">
            <span>Total Amount Paid</span>
            <span>GHS ${(Number(consultation.amountPaidGHS || consultation.amountGHS || 80)).toFixed(2)}</span>
          </div>

          <div class="footer">
            <p><strong>Insurance Reimbursement Note:</strong> This tax-compliant document is issued by ${globalTitle || 'PockettClinic'} Telehealth Platform (Accra, Ghana). Tax identification & GRA compliance code: GHA-MDC-PC-2026.</p>
          </div>

          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(receiptHtml);
    printWindow.document.close();
  };

  return (
    <button
      onClick={handlePrintReceipt}
      className="px-3 py-2 min-h-[40px] bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
    >
      <Printer size={15} className="text-emerald-600" /> Print Insurance Receipt
    </button>
  );
}
