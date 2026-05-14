/**
 * StatCard component - Reusable stat card for admin dashboard
 * Displays key metrics with trend indicators
 */
import React from "react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: string;
  trendDirection?: "up" | "down" | "neutral";
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  trend,
  trendDirection = "neutral",
}) => {
  const trendColor = {
    up: "text-green-400",
    down: "text-red-400",
    neutral: "text-white/60",
  }[trendDirection];

  const trendIcon = {
    up: "↑",
    down: "↓",
    neutral: "→",
  }[trendDirection];

  return (
    <div className="bg-[#141414] border border-white/8 rounded-lg p-6 hover:border-white/16 transition-colors">
      <p className="text-white/60 text-sm font-dm-sans mb-2">{title}</p>
      <div className="flex items-baseline gap-3">
        <h3 className="font-syne text-3xl font-bold text-white">{value}</h3>
        {trend && (
          <span className={`text-sm font-dm-sans ${trendColor}`}>
            {trendIcon} {trend}
          </span>
        )}
      </div>
      {subtitle && (
        <p className="text-white/40 text-xs font-dm-sans mt-2">{subtitle}</p>
      )}
    </div>
  );
};
