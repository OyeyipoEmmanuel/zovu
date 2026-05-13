import React, { useState, useEffect } from 'react';
import { partnerAPI } from '../../lib/api';
import type { MyLoanRecord } from '../../lib/api';
import { HiOutlineDocumentDuplicate } from 'react-icons/hi';

const getServiceTypeBadge = (type: string) => {
  switch (type) {
    case 'loan': return 'bg-[#1A6B4A]/10 text-[#1A6B4A] border-[#1A6B4A]/20';
    case 'insurance': return 'bg-[#F4A11D]/10 text-[#F4A11D] border-[#F4A11D]/20';
    case 'savings': return 'bg-[#3B82F6]/10 text-[#3B82F6] border-[#3B82F6]/20';
    default: return 'bg-zovu-surface-2 text-zovu-text border-zovu-border';
  }
};

export const MyServices: React.FC = () => {
  const [services, setServices] = useState<any[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'loan' | 'insurance' | 'savings' | 'overdue'>('all');
  const [copiedRef, setCopiedRef] = useState<string | null>(null);

  useEffect(() => {
    const fetchServices = async () => {
      setLoadingServices(true);
      try {
        const data = await partnerAPI.getMyServices(activeTab === 'all' ? undefined : activeTab);
        setServices(data as any[]);
      } catch (e) {
        // handle error silently
      } finally {
        setLoadingServices(false);
      }
    };
    fetchServices();
  }, [activeTab]);

  const handleCopy = (ref: string) => {
    navigator.clipboard.writeText(ref);
    setCopiedRef(ref);
    setTimeout(() => setCopiedRef(null), 2000);
  };

  const formatCurrency = (amount: number) => {
    return '₦' + amount.toLocaleString('en-NG');
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getEmptyStateMessage = () => {
    switch (activeTab) {
      case 'loan': return "No loan services at the moment.";
      case 'insurance': return "No insurance services yet.";
      case 'savings': return "No savings services yet.";
      case 'overdue': return "No overdue services. Great health!";
      default: return "You have not offered any services yet. Go to the customer pool to offer your first service.";
    }
  };

  const tabs = ['all', 'loan', 'insurance', 'savings', 'overdue'] as const;
  const tabLabels: Record<string, string> = {
    all: 'All',
    loan: 'Loans',
    insurance: 'Insurance',
    savings: 'Savings',
    overdue: 'Overdue'
  };

  return (
    <div className="max-w-6xl mx-auto text-zovu-text">
      <h1 className="font-syne text-[28px] font-bold text-zovu-text-light mb-8">My Services</h1>

      {/* Filter Tabs */}
      <div className="flex border-b border-zovu-border mb-8 overflow-x-auto no-scrollbar">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 font-dm text-[14px] font-medium capitalize whitespace-nowrap transition-colors duration-200 border-b-2 -mb-[1px] ${
              activeTab === tab 
                ? 'border-[#1A6B4A] text-[#1A6B4A]' 
                : 'border-transparent text-zovu-text hover:text-zovu-text-light'
            }`}
          >
            {tabLabels[tab]}
          </button>
        ))}
      </div>

      {/* Service List */}
      <div className="space-y-4">
        {loadingServices ? (
          // Skeleton Loader
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-zovu-surface-1 border border-zovu-border rounded-[16px] p-6 animate-pulse">
              <div className="flex justify-between mb-4">
                <div className="h-5 bg-zovu-surface-2 rounded w-1/4"></div>
                <div className="h-6 bg-zovu-surface-2 rounded-full w-20"></div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="h-4 bg-zovu-surface-2 rounded w-full"></div>
                <div className="h-4 bg-zovu-surface-2 rounded w-full"></div>
                <div className="h-4 bg-zovu-surface-2 rounded w-full"></div>
                <div className="h-4 bg-zovu-surface-2 rounded w-full"></div>
              </div>
            </div>
          ))
        ) : services.length === 0 ? (
          // Empty State
          <div className="bg-zovu-surface-1 border border-zovu-border rounded-[16px] p-12 text-center">
            <p className="font-dm text-[15px] text-zovu-text">
              {getEmptyStateMessage()}
            </p>
          </div>
        ) : (
          // Services
          services.map((service, idx) => {
            if (service.type === 'insurance') {
              // Insurance service card
              const statusColor = 
                service.status === 'active' ? 'bg-[#1A6B4A]/10 text-[#1A6B4A] border-[#1A6B4A]/20' :
                service.status === 'cancelled' ? 'bg-[#A0A0A0]/10 text-[#A0A0A0] border-[#A0A0A0]/20' :
                'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20';

              return (
                <div key={service.id || idx} className="bg-zovu-surface-1 border border-zovu-border rounded-[16px] p-6 transition-colors hover:border-zovu-border/80">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <div>
                      <h3 className="font-syne text-[18px] font-bold text-zovu-text-light">
                        {service.customer_name}
                      </h3>
                      <p className="font-dm text-[13px] text-zovu-text mt-1">{service.product_name}</p>
                    </div>
                    
                    <div className="flex flex-row-reverse sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-dm font-semibold tracking-wider uppercase ${getServiceTypeBadge('insurance')}`}>
                          Insurance
                        </span>
                        <span className={`px-3 py-1 rounded-full border text-[11px] font-syne font-bold tracking-wider uppercase ${statusColor}`}>
                          {service.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-dm text-[13px]">
                    <div>
                      <p className="text-zovu-text/60 mb-1">Monthly Premium</p>
                      <p className="text-zovu-text-light font-medium">{formatCurrency(service.monthly_premium)}</p>
                    </div>
                    <div>
                      <p className="text-zovu-text/60 mb-1">Coverage Amount</p>
                      <p className="text-zovu-text-light font-medium">{formatCurrency(service.coverage_amount)}</p>
                    </div>
                    <div>
                      <p className="text-zovu-text/60 mb-1">Next Deduction</p>
                      <p className="text-zovu-text-light font-medium">{formatDate(service.next_deduction)}</p>
                    </div>
                    <div>
                      <p className="text-zovu-text/60 mb-1">Status</p>
                      <p className="text-zovu-text-light font-medium capitalize">{service.status}</p>
                    </div>
                  </div>
                </div>
              );
            }

            // Loan service card (existing)
            const loan = service as MyLoanRecord & { type: string };
            const progress = (loan.amount_repaid / loan.total_repayment) * 100;
            const isOverdue = loan.status === 'overdue';
            const progressColor = isOverdue ? 'bg-[#EF4444]' : 'bg-[#1A6B4A]';
            const badgeColor = 
              loan.status === 'active' ? 'bg-[#1A6B4A]/10 text-[#1A6B4A] border-[#1A6B4A]/20' :
              loan.status === 'repaid' ? 'bg-[#A0A0A0]/10 text-[#A0A0A0] border-[#A0A0A0]/20' :
              'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20';

            return (
              <div key={loan.transaction_ref || idx} className="bg-zovu-surface-1 border border-zovu-border rounded-[16px] p-6 transition-colors hover:border-zovu-border/80">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                  <div>
                    <h3 className="font-syne text-[18px] font-bold text-zovu-text-light">
                      {loan.borrower_name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-dm text-[12px] text-zovu-text">Ref: {loan.transaction_ref}</span>
                      <button 
                        onClick={() => handleCopy(loan.transaction_ref)}
                        className="text-zovu-text hover:text-zovu-primary transition-colors relative group"
                        title="Copy Transaction Ref"
                      >
                        <HiOutlineDocumentDuplicate size={14} />
                        {copiedRef === loan.transaction_ref && (
                          <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-zovu-surface-2 text-zovu-text-light text-[10px] px-2 py-1 rounded">Copied!</span>
                        )}
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex flex-row-reverse sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-dm font-semibold tracking-wider uppercase ${getServiceTypeBadge('loan')}`}>
                        Loan
                      </span>
                      <span className={`px-3 py-1 rounded-full border text-[11px] font-syne font-bold tracking-wider uppercase ${badgeColor}`}>
                        {loan.status}
                      </span>
                    </div>
                    <span className="font-syne text-[20px] font-bold text-[#F4A11D]">
                      {formatCurrency(loan.amount)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 font-dm text-[13px]">
                  <div>
                    <p className="text-zovu-text/60 mb-1">Disbursed Date</p>
                    <p className="text-zovu-text-light font-medium">{formatDate(loan.disbursed_at)}</p>
                  </div>
                  <div>
                    <p className="text-zovu-text/60 mb-1">Repayment Period</p>
                    <p className="text-zovu-text-light font-medium">{loan.repayment_days} days</p>
                  </div>
                  <div>
                    <p className="text-zovu-text/60 mb-1">Due Date</p>
                    <p className="text-zovu-text-light font-medium">{formatDate(loan.due_date)}</p>
                  </div>
                  <div>
                    <p className="text-zovu-text/60 mb-1">Repaid So Far</p>
                    <p className="text-zovu-text-light font-medium">
                      {formatCurrency(loan.amount_repaid)} of {formatCurrency(loan.total_repayment)}
                    </p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-zovu-surface-2 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className={`h-full ${progressColor} transition-all duration-1000 ease-out`} 
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  ></div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
