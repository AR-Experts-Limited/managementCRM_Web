import React from "react";
import TailwindBarChart from "./TailwindBarChart";

const BarChart = ({
  title = "Job Statistics",
  dataMap = { Jan: 180, Feb: 260, Mar: 320, Apr: 160, May: 280, Jun: 420, Jul: 300, Aug: 260, Sep: 380 },
  yMax = 650,
}) => {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-white p-4">
      {/* Diagonal dark overlay (keeps Y-axis area white by starting after 56px) */}
      <div
        className="pointer-events-none absolute inset-y-0 left-14 right-0 -z-0"
        style={{
          background:
            "linear-gradient(135deg, #0f172a 0%, #0f172a 58%, rgba(255,255,255,0) 58%)",
        }}
      />

      {/* Header */}
      <div className="relative z-10 mb-3 flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">{" "}{title}</h3>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            <span className="text-xs text-neutral-500">Job View</span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="relative z-10">
        <TailwindBarChart
          dataMap={dataMap}
          height={260}
          yDomain={[0, yMax]}
          yTicks={6}
          showGrid
          showValues={false}
          sort="none"
          // Rounded, single bar with a vertical gradient similar to the mock
          barRadius="rounded-t-xl"
          barColor="bg-gradient-to-t from-blue-600 to-blue-400"
          gapX="gap-3"
          // Simple formatters
          xFormatter={(v) => String(v)}
          yFormatter={(v) => Math.round(v)}
        />
      </div>
    </div>
  );
};

export default BarChart;
