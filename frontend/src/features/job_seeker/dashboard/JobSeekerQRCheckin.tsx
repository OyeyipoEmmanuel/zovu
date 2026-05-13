import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { jobSeekerAPI } from '../../../lib/api';

export const JobSeekerQRCheckin: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qrData, setQrData] = useState<{
    customer_identifier: string;
    zovu_id: string;
    name: string;
    skills: string[];
  } | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await jobSeekerAPI.getQRCode();
      setQrData(data as typeof qrData);
    } catch {
      setError('Failed to load QR code');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleShare = () => {
    const svgEl = document.getElementById('qr-code-svg');
    if (!svgEl) return;

    const svgData = new XMLSerializer().serializeToString(svgEl);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      canvas.width = img.width * 2;
      canvas.height = img.height * 2;
      ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);

      canvas.toBlob((blob) => {
        if (!blob) return;
        if (navigator.share) {
          const file = new File([blob], 'zovu-qr.png', { type: 'image/png' });
          navigator.share({ files: [file], title: 'My Zovu QR Code' }).catch(() => {});
        } else {
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = 'zovu-qr.png';
          a.click();
        }
      }, 'image/png');
    };
    img.src = url;
  };

  if (loading) {
    return (
      <div className="max-w-md mx-auto w-full flex flex-col items-center gap-6 animate-pulse">
        <div className="h-8 w-40 bg-zovu-surface-1 rounded" />
        <div className="w-64 h-64 bg-zovu-surface-1 rounded-[16px]" />
        <div className="h-4 w-32 bg-zovu-surface-1 rounded" />
      </div>
    );
  }

  if (error || !qrData) {
    return (
      <div className="max-w-md mx-auto w-full">
        <div className="bg-red-500/10 border border-red-500/20 p-8 rounded-[16px] text-center">
          <p className="text-red-400 font-dm mb-4">{error || 'Failed to load QR code'}</p>
          <button onClick={loadData} className="px-6 py-2 bg-zovu-surface-2 text-zovu-text-light rounded-md font-dm">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto w-full flex flex-col items-center gap-6">
      <div className="text-center">
        <h1 className="font-syne text-[28px] font-bold text-zovu-text-light">My QR Code</h1>
        <p className="font-dm text-[14px] text-zovu-text mt-1">Show this to your employer when you arrive on site</p>
      </div>

      {/* QR Code */}
      <div className="bg-white rounded-[20px] p-6">
        <QRCodeSVG
          id="qr-code-svg"
          value={qrData.customer_identifier}
          size={220}
          level="H"
          fgColor="#0D0D0D"
          bgColor="#FFFFFF"
        />
      </div>

      {/* Info */}
      <div className="bg-zovu-surface-1 border border-zovu-border rounded-[16px] p-6 w-full">
        <div className="flex flex-col gap-3">
          <div className="flex justify-between font-dm text-[14px]">
            <span className="text-zovu-text">Name</span>
            <span className="text-zovu-text-light font-medium">{qrData.name}</span>
          </div>
          <div className="flex justify-between font-dm text-[14px]">
            <span className="text-zovu-text">Skills</span>
            <div className="flex flex-wrap justify-end gap-1.5">
              {qrData.skills.map((s, i) => (
                <span key={i} className="px-2 py-0.5 rounded-full bg-[#1A6B4A]/10 text-[#1A6B4A] text-[11px] font-dm">{s}</span>
              ))}
            </div>
          </div>
          <div className="flex justify-between font-dm text-[14px]">
            <span className="text-zovu-text">Zovu ID</span>
            <span className="text-zovu-text-light font-medium font-mono text-[13px]">{qrData.zovu_id}</span>
          </div>
        </div>
      </div>

      {/* Instruction */}
      <div className="bg-[#F4A11D]/5 border border-[#F4A11D]/20 rounded-[12px] p-4 w-full">
        <p className="font-dm text-[13px] text-[#F4A11D] text-center leading-relaxed">
          Your employer scans this to confirm your arrival. This records your punctuality and builds your Pulse Score.
        </p>
      </div>

      {/* Share Button */}
      <button
        onClick={handleShare}
        className="w-full bg-[#1A6B4A] text-white font-dm font-bold text-[16px] py-4 rounded-[12px] hover:brightness-110 transition-all flex items-center justify-center gap-2"
      >
        📤 Share QR Code
      </button>
    </div>
  );
};
