import React from 'react';
import { useLenderStore } from '../../stores/lenderStore';
import { lenderAPI } from '../../lib/api';

export const FundConfirmationModal: React.FC<{
  onClose: () => void;
}> = ({ onClose }) => {
  const { selectedBorrower, disbursing, disburseSuccess, setDisbursing, setDisburseSuccess } = useLenderStore();

  if (!selectedBorrower) return null;

  const handleConfirm = async () => {
    setDisbursing(true);
    try {
      await lenderAPI.disburse({
        borrower_id: selectedBorrower.id,
        amount: selectedBorrower.loan_amount_requested,
        repayment_days: selectedBorrower.repayment_days,
      });
      setDisburseSuccess(true);
    } catch (err) {
      alert("Disbursement failed. Please try again.");
    } finally {
      setDisbursing(false);
    }
  };

  const platformFee = selectedBorrower.loan_amount_requested * 0.02;
  const totalDeducted = selectedBorrower.loan_amount_requested + platformFee;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md overflow-y-auto">
      <div className="bg-zovu-surface-1 border border-zovu-border rounded-[16px] max-w-md w-full p-6 sm:p-8 shadow-2xl animate-slide-in relative my-8">
        
        {!disbursing && !disburseSuccess && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-zovu-text hover:text-zovu-text-light transition-colors z-10"
          >
            ✕
          </button>
        )}

        {disburseSuccess ? (
          <div className="flex flex-col items-center text-center pt-4">
            <div className="w-16 h-16 bg-zovu-primary/20 rounded-full flex items-center justify-center mb-6 animate-pulse">
              <div className="w-10 h-10 bg-zovu-primary rounded-full flex items-center justify-center text-zovu-primary-text shadow-lg">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
              </div>
            </div>

            <h2 className="font-syne text-[22px] font-bold text-zovu-text-light mb-2">
              Disbursed Successfully
            </h2>
            <p className="font-dm text-[14px] text-zovu-text mb-8 leading-relaxed">
              <span className="font-semibold text-zovu-text-light">₦{selectedBorrower.loan_amount_requested.toLocaleString('en-NG')}</span> has been sent to {selectedBorrower.full_name}'s Zovu account. Repayment begins in 7 days.
            </p>

            <button
              onClick={onClose}
              className="w-full bg-zovu-primary text-zovu-primary-text font-dm font-medium text-[16px] py-4 rounded-[10px] hover:brightness-110 active:scale-[0.99] transition-all"
            >
              Back to Borrower Pool
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-6 pt-2">
            <div>
              <h2 className="font-syne text-[22px] font-bold text-zovu-text-light mb-1">Confirm Loan Disbursement</h2>
              <p className="font-dm text-[13px] text-zovu-text">Please review the details below before confirming.</p>
            </div>

            <div className="bg-[#121212] border border-zovu-border rounded-[12px] p-4 flex flex-col gap-3">
              <div className="flex justify-between font-dm text-[13px]">
                <span className="text-zovu-text">Borrower:</span>
                <span className="text-zovu-text-light font-medium">{selectedBorrower.full_name}</span>
              </div>
              <div className="flex justify-between font-dm text-[13px]">
                <span className="text-zovu-text">Loan Amount:</span>
                <span className="text-zovu-text-light font-medium">₦{selectedBorrower.loan_amount_requested.toLocaleString('en-NG')}</span>
              </div>
              <div className="flex justify-between font-dm text-[13px]">
                <span className="text-zovu-text">Repayment Period:</span>
                <span className="text-zovu-text-light font-medium">{selectedBorrower.repayment_days} days</span>
              </div>
              <div className="flex justify-between font-dm text-[13px]">
                <span className="text-zovu-text">Platform Fee (2%):</span>
                <span className="text-zovu-text-light font-medium">₦{platformFee.toLocaleString('en-NG')}</span>
              </div>
              <div className="w-full h-px bg-zovu-border my-1" />
              <div className="flex justify-between font-dm text-[14px]">
                <span className="text-zovu-text">Total Deducted from Wallet:</span>
                <span className="text-zovu-primary font-bold">₦{totalDeducted.toLocaleString('en-NG')}</span>
              </div>
            </div>

            <p className="font-dm text-[12px] text-zovu-text-light text-center leading-relaxed">
              Funds will be sent instantly to the borrower's Zovu Squad account upon confirmation.
            </p>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={disbursing}
                className="flex-1 py-4 bg-zovu-surface-2 hover:bg-zovu-surface-2/80 text-zovu-text-light font-dm text-[15px] font-medium rounded-[10px] transition-colors border border-zovu-border disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={disbursing}
                className="flex-[2] py-4 bg-zovu-primary hover:brightness-110 text-zovu-primary-text font-dm text-[15px] font-medium rounded-[10px] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {disbursing && <div className="w-4 h-4 border-2 border-zovu-primary-text/30 border-t-zovu-primary-text rounded-full animate-spin" />}
                {disbursing ? 'Disbursing...' : 'Confirm & Disburse →'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
