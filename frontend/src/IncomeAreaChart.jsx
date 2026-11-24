import React from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';

export default function IncomeAreaChart({ incomeHistory, dipThreshold, theme = 'dark' }) {
  if (!incomeHistory || incomeHistory.length === 0) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100%', color: 'var(--text-muted)', textAlign: 'center', padding: 20
      }}>
        <div style={{ fontSize: 13, marginBottom: 6, fontWeight: 500 }}>No recorded income history yet.</div>
        <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
          Link your Till or declare weekly cash sales to visualize your actuarial trendline.
        </div>
      </div>
    );
  }

  const isLight = theme === 'light';
  const strokeColor = isLight ? '#101828' : '#B7A78B';
  const gridColor = isLight ? '#E6E9EE' : '#222C3D';
  const tickColor = isLight ? '#667085' : '#94A3B8';
  const tooltipBg = isLight ? '#FFFFFF' : '#162238';
  const tooltipBorder = isLight ? '#E6E9EE' : '#2F3A4D';
  const tooltipText = isLight ? '#101828' : '#F4F6F9';
  const dipFloorColor = isLight ? '#9A5B04' : '#E8A638';

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={incomeHistory} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorAmountStone" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={strokeColor} stopOpacity={isLight ? 0.12 : 0.22}/>
            <stop offset="95%" stopColor={strokeColor} stopOpacity={0}/>
          </linearGradient>
        </defs>
        
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
        
        <XAxis
          dataKey="month"
          stroke={gridColor}
          tick={{ fill: tickColor, fontSize: 12, fontFamily: 'DM Sans' }}
          tickLine={false}
          axisLine={{ stroke: gridColor }}
        />
        
        <YAxis
          stroke={gridColor}
          tick={{ fill: tickColor, fontSize: 12, fontFamily: 'DM Sans' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
        />
        
        <Tooltip
          contentStyle={{
            backgroundColor: tooltipBg,
            border: `1px solid ${tooltipBorder}`,
            borderRadius: '10px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
            fontSize: 13,
            fontFamily: 'DM Sans',
            padding: '10px 14px'
          }}
          itemStyle={{ color: tooltipText, fontWeight: 600 }}
          formatter={(value) => [`KES ${Number(value).toLocaleString()}`, 'Income']}
          labelStyle={{ color: tickColor, marginBottom: 4 }}
        />
        
        {dipThreshold > 0 && (
          <ReferenceLine
            y={dipThreshold}
            stroke={dipFloorColor}
            strokeDasharray="4 4"
            strokeWidth={1.5}
            label={{
              value: `Dip Floor: KES ${Math.round(dipThreshold).toLocaleString()}`,
              fill: dipFloorColor,
              fontSize: 11,
              fontFamily: 'DM Sans',
              position: 'insideTopLeft'
            }}
          />
        )}
        
        <Area
          type="monotone"
          dataKey="amount"
          stroke={strokeColor}
          fillOpacity={1}
          fill="url(#colorAmountStone)"
          strokeWidth={2}
          dot={{ r: 3.5, fill: strokeColor, strokeWidth: 0 }}
          activeDot={{ r: 5, fill: strokeColor, stroke: tooltipBg, strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
