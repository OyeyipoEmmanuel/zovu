
import React from 'react';

interface Column {
  header: string;
  key: string;
  render?: (value: any, item: any) => React.ReactNode;
}

interface AdminTableProps {
  columns: Column[];
  data: any[];
  isLoading?: boolean;
  onRowClick?: (item: any) => void;
  nextCursor?: string | null;
  onLoadMore?: () => void;
}

const AdminTable: React.FC<AdminTableProps> = ({
  columns,
  data,
  isLoading,
  onRowClick,
  nextCursor,
  onLoadMore,
}) => {
  if (isLoading && data.length === 0) {
    return (
      <div className="w-full space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 bg-white/5 animate-pulse rounded-[8px]" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="w-full py-20 text-center border border-dashed border-white/10 rounded-[12px]">
        <p className="font-dm text-[14px] text-[#A0A0A0]">No data found</p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-white/5">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="text-left py-4 px-4 font-dm text-[12px] font-medium text-[#A0A0A0] uppercase tracking-wider"
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {data.map((item, idx) => (
              <tr
                key={item.id || idx}
                onClick={() => onRowClick?.(item)}
                className={`group hover:bg-white/[0.02] transition-colors ${
                  onRowClick ? 'cursor-pointer' : ''
                }`}
              >
                {columns.map((col) => (
                  <td key={col.key} className="py-4 px-4 font-dm text-[14px] text-[#F5F5F5]">
                    {col.render ? col.render(item[col.key], item) : item[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {nextCursor && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={onLoadMore}
            disabled={isLoading}
            className="px-6 py-2 bg-[#2A2A2A] text-white font-dm text-[13px] rounded-[8px] hover:bg-[#333] transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminTable;
