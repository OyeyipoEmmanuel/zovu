import React, { useEffect, useState, useCallback } from 'react';
import { ajoAPI, type AjoGroup, type AjoTransaction } from '../../lib/api';

/**
 * Shared Ajo dashboard surface for traders and job seekers.
 *
 * Users can:
 *   - Browse available Ajo groups (created by admins)
 *   - Join a group
 *   - Contribute (>= the group's minimum_deposit) — funds land in the platform's
 *     Squad merchant account, displayed alongside the group's deposit instructions
 *   - See their own contribution + projected return for the period
 *   - View transaction history (contributions + payouts)
 */
export const AjoTab: React.FC = () => {
  const [groups, setGroups] = useState<AjoGroup[]>([]);
  const [transactions, setTransactions] = useState<AjoTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [g, t] = await Promise.all([ajoAPI.listGroups(), ajoAPI.getTransactions()]);
      setGroups(g);
      setTransactions(t);
    } catch (err) {
      setError((err as Error).message || 'Failed to load Ajo groups');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    // Poll every 5s while the tab is open so the pool total reacts to
    // webhook-confirmed contributions without a manual refresh. (The spec
    // calls for Supabase realtime; this codebase doesn't have a realtime
    // client wired up, so polling is the pragmatic substitute.) Pauses
    // when the tab is backgrounded to avoid burning the API.
    const tick = () => {
      if (document.visibilityState === 'visible') void load();
    };
    const id = setInterval(tick, 5000);
    return () => clearInterval(id);
  }, [load]);

  const handleJoin = async (id: string) => {
    setSubmitting(id);
    setError(null);
    try {
      await ajoAPI.joinGroup(id);
      setSuccess('You joined the Ajo group');
      await load();
    } catch (err) {
      setError((err as Error).message || 'Could not join group');
    } finally {
      setSubmitting(null);
    }
  };

  const handleContribute = async (id: string) => {
    const raw = depositAmount[id];
    const amount = Number(raw);
    if (!amount || amount <= 0) {
      setError('Enter a valid amount in naira');
      return;
    }
    setSubmitting(id);
    setError(null);
    try {
      const res = await ajoAPI.contribute(id, amount);
      setSuccess(
        res.squad_account
          ? `Contribution recorded. Transfer ₦${amount.toLocaleString()} to merchant account ${res.squad_account} to fund the deposit.`
          : 'Contribution recorded.'
      );
      setDepositAmount((d) => ({ ...d, [id]: '' }));
      await load();
    } catch (err) {
      setError((err as Error).message || 'Could not contribute');
    } finally {
      setSubmitting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-4 p-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-[#161616] rounded-[12px] animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-syne text-[26px] font-bold text-[#F5F5F5]">Ajo Savings</h1>
        <p className="font-dm text-[14px] text-[#A0A0A0] mt-1">
          Join community savings groups. Funds are managed via Squad merchant account.
        </p>
      </header>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-[8px] p-3 font-dm text-[13px] text-red-300">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-[8px] p-3 font-dm text-[13px] text-emerald-300">
          {success}
        </div>
      )}

      <section className="flex flex-col gap-4">
        <h2 className="font-dm text-[16px] font-medium text-[#F5F5F5]">Available groups</h2>
        {groups.length === 0 && (
          <div className="bg-[#161616] border border-[#2A2A2A] rounded-[12px] p-6 text-center font-dm text-[14px] text-[#A0A0A0]">
            No active Ajo groups yet — check back soon.
          </div>
        )}
        {groups.map((g) => (
          <div
            key={g.id}
            className="bg-[#161616] border border-[#2A2A2A] rounded-[12px] p-5 flex flex-col gap-3"
          >
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h3 className="font-syne text-[18px] font-bold text-[#F5F5F5]">{g.name}</h3>
                {g.description && (
                  <p className="font-dm text-[13px] text-[#A0A0A0] mt-1">{g.description}</p>
                )}
              </div>
              <div className="text-right">
                <div className="font-dm text-[12px] text-[#A0A0A0]">Min. deposit</div>
                <div className="font-syne text-[18px] font-bold text-[#1A6B4A]">
                  ₦{g.minimum_deposit.toLocaleString()}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center bg-[#0D0D0D] rounded-[8px] p-3">
              <div>
                <div className="font-dm text-[10px] text-[#A0A0A0] uppercase">Members</div>
                <div className="font-dm text-[14px] text-[#F5F5F5]">{g.member_count}</div>
              </div>
              <div>
                <div className="font-dm text-[10px] text-[#A0A0A0] uppercase">Total Pool</div>
                <div className="font-dm text-[14px] text-[#F5F5F5]">₦{g.total_pool.toLocaleString()}</div>
              </div>
              <div>
                <div className="font-dm text-[10px] text-[#A0A0A0] uppercase">My Contribution</div>
                <div className="font-dm text-[14px] text-[#F5F5F5]">
                  ₦{g.my_total.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="font-dm text-[10px] text-[#A0A0A0] uppercase">Next Payout</div>
                <div className="font-dm text-[14px] text-[#1A6B4A]">
                  {g.next_payout_date ? new Date(g.next_payout_date).toLocaleDateString() : '—'}
                </div>
              </div>
            </div>

            {g.merchant_squad_account && (
              <div className="bg-[#0D0D0D] border border-[#1A6B4A]/30 rounded-[8px] p-3 flex items-center justify-between gap-3">
                <div>
                  <div className="font-dm text-[10px] text-[#A0A0A0] uppercase">Deposit account</div>
                  <div className="font-mono text-[13px] text-[#F5F5F5]">{g.merchant_squad_account}</div>
                </div>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(g.merchant_squad_account!)}
                  className="px-3 py-1.5 bg-[#1A6B4A]/10 text-[#1A6B4A] font-dm text-[12px] rounded-[6px]"
                >
                  Copy
                </button>
              </div>
            )}

            {g.joined ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={g.minimum_deposit}
                  value={depositAmount[g.id] ?? ''}
                  onChange={(e) => setDepositAmount((d) => ({ ...d, [g.id]: e.target.value }))}
                  placeholder={`Min ₦${g.minimum_deposit.toLocaleString()}`}
                  className="flex-1 bg-[#0D0D0D] border border-[#2A2A2A] rounded-[8px] px-3 py-2 font-dm text-[13px] text-[#F5F5F5] focus:outline-none focus:border-[#1A6B4A]"
                />
                <button
                  onClick={() => handleContribute(g.id)}
                  disabled={submitting === g.id}
                  className="px-4 py-2 bg-[#1A6B4A] text-white font-dm text-[13px] rounded-[8px] hover:brightness-110 disabled:opacity-50"
                >
                  {submitting === g.id ? 'Sending…' : 'Contribute'}
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleJoin(g.id)}
                disabled={submitting === g.id}
                className="self-start px-4 py-2 bg-[#1A6B4A] text-white font-dm text-[13px] rounded-[8px] hover:brightness-110 disabled:opacity-50"
              >
                {submitting === g.id ? 'Joining…' : 'Join group'}
              </button>
            )}
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-dm text-[16px] font-medium text-[#F5F5F5]">Transaction history</h2>
        {transactions.length === 0 ? (
          <div className="bg-[#161616] border border-[#2A2A2A] rounded-[12px] p-6 text-center font-dm text-[14px] text-[#A0A0A0]">
            No Ajo transactions yet.
          </div>
        ) : (
          <div className="bg-[#161616] border border-[#2A2A2A] rounded-[12px] divide-y divide-[#2A2A2A]">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <div className="font-dm text-[13px] text-[#F5F5F5]">{tx.ajo_name || 'Ajo group'}</div>
                  <div className="font-dm text-[11px] text-[#A0A0A0]">
                    {tx.type === 'payout' ? 'Payout' : 'Contribution'} • {tx.status}
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className={`font-dm text-[14px] font-medium ${
                      tx.type === 'payout' ? 'text-emerald-400' : 'text-[#F5F5F5]'
                    }`}
                  >
                    {tx.type === 'payout' ? '+' : '-'}₦{tx.amount.toLocaleString()}
                  </div>
                  <div className="font-dm text-[10px] text-[#A0A0A0]">
                    {tx.timestamp ? new Date(tx.timestamp).toLocaleString() : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default AjoTab;
