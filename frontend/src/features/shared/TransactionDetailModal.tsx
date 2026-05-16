import React, { useEffect, useState } from 'react';
import { X, Printer, ArrowDown, ArrowUp, Loader2 } from 'lucide-react';
import { fetchTransactionDetail, type TransactionDetail } from '../../lib/api';

interface Props {
  transactionId: string;
  onClose: () => void;
}

const formatNaira = (kobo: number) =>
  `₦${(kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDate = (iso: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' });
};

const DashedDivider: React.FC = () => (
  <div className="font-mono text-[12px] text-zovu-text/60 select-none">
    ----------------------------------------
  </div>
);

const Row: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex justify-between items-start gap-3 py-1.5">
    <span className="font-dm text-[13px] text-zovu-text">{label}</span>
    <span className="font-dm text-[13px] text-zovu-text-light text-right break-all">{value}</span>
  </div>
);

/**
 * Detail modal for a single transaction row. Fetches `/transactions/:id/detail`
 * on mount and renders both an on-screen layout (`.no-print`) and a thermal
 * receipt layout (`.print-only`) that becomes the only visible element when
 * the user hits the Print Receipt button (or Ctrl+P).
 */
export const TransactionDetailModal: React.FC<Props> = ({ transactionId, onClose }) => {
  const [detail, setDetail] = useState<TransactionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const d = await fetchTransactionDetail(transactionId);
        if (!cancelled) setDetail(d);
      } catch (e) {
        if (!cancelled) setError((e as Error).message || 'Failed to load transaction');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [transactionId]);

  // Esc closes the modal — natural-feeling for keyboard users.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      <div
        className="no-print fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div
          className="bg-zovu-surface-1 border border-zovu-border rounded-[16px] w-full max-w-md max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-zovu-border">
            <h2 className="font-syne text-[18px] font-bold text-zovu-text-light">Transaction Details</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="p-1.5 rounded-md text-zovu-text hover:text-zovu-text-light hover:bg-zovu-surface-2 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <div className="p-5">
            {loading && (
              <div className="flex items-center justify-center py-10">
                <Loader2 size={24} className="animate-spin text-zovu-primary" />
              </div>
            )}

            {error && !loading && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-[8px] p-4 font-dm text-[13px] text-red-300">
                {error}
              </div>
            )}

            {detail && !loading && (
              <>
                {/* Headline */}
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      detail.direction === 'inflow' ? 'bg-zovu-primary/10 text-zovu-primary' : 'bg-red-500/10 text-red-400'
                    }`}
                  >
                    {detail.direction === 'inflow' ? <ArrowDown size={20} /> : <ArrowUp size={20} />}
                  </div>
                  <div>
                    <div className="font-syne text-[22px] font-bold text-zovu-text-light">
                      {detail.direction === 'inflow' ? '+' : '-'}
                      {formatNaira(detail.amount)}
                    </div>
                    <div className="font-dm text-[12px] text-zovu-text">{detail.type_label}</div>
                  </div>
                </div>

                <Row label="Counterparty" value={detail.counterparty || '—'} />
                <Row label="Description" value={detail.description || '—'} />
                <Row label="Status" value={<span className="capitalize">{detail.status}</span>} />
                <Row label="Type" value={detail.type_label} />
                <Row label="Direction" value={<span className="capitalize">{detail.direction}</span>} />
                <Row label="Date" value={formatDate(detail.created_at)} />
                <Row label="Reference" value={<span className="font-mono text-[11px]">{detail.reference}</span>} />
                {detail.squad_transaction_id && (
                  <Row
                    label="Squad Tx"
                    value={<span className="font-mono text-[11px]">{detail.squad_transaction_id}</span>}
                  />
                )}

                <button
                  type="button"
                  onClick={handlePrint}
                  className="mt-5 w-full inline-flex items-center justify-center gap-2 bg-zovu-primary text-white font-dm font-medium text-[14px] py-3 rounded-[10px] hover:brightness-110 transition-all"
                >
                  <Printer size={16} />
                  Print Receipt
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Thermal-receipt layout — invisible on screen, the only thing printed. */}
      {detail && (
        <div className="print-only" aria-hidden="true">
          <div style={{ textAlign: 'center', marginBottom: 6 }}>
            <strong>ZOVU</strong>
            <div style={{ fontSize: 10 }}>Connect. Work. Grow.</div>
          </div>
          <DashedDivider />
          <div style={{ textAlign: 'center', margin: '6px 0' }}>
            <strong>{detail.type_label}</strong>
          </div>
          <div style={{ textAlign: 'center', margin: '6px 0', fontSize: 14 }}>
            <strong>
              {detail.direction === 'inflow' ? '+' : '-'}
              {formatNaira(detail.amount)}
            </strong>
          </div>
          <DashedDivider />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Counterparty</span>
            <span>{detail.counterparty || '—'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Description</span>
            <span>{detail.description || '—'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Status</span>
            <span>{detail.status}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Direction</span>
            <span>{detail.direction}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Date</span>
            <span>{formatDate(detail.created_at)}</span>
          </div>
          {detail.squad_transaction_id && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Squad Tx</span>
              <span>{detail.squad_transaction_id}</span>
            </div>
          )}
          <DashedDivider />
          <div style={{ textAlign: 'center', fontSize: 10, marginTop: 6 }}>
            Ref: {detail.reference}
          </div>
          <div style={{ textAlign: 'center', fontSize: 10, marginTop: 4 }}>
            Thank you for using ZOVU.
          </div>
        </div>
      )}
    </>
  );
};

export default TransactionDetailModal;
