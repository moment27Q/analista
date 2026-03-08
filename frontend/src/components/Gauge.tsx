import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface GaugeProps {
    title: string;
    value: string; // Formatting like "$450,000"
    percentage: number; // 0-100
    color: string;
    trendText: string;
    trendIsPositive: boolean;
}

const Gauge: React.FC<GaugeProps> = ({ title, value, percentage, color, trendText, trendIsPositive }) => {
    const radius = 60;
    const strokeWidth = 14;
    const circumference = Math.PI * radius;
    // Cap percentage between 0 and 100
    const clampedPercentage = Math.max(0, Math.min(percentage, 100));
    const strokeDashoffset = circumference - (clampedPercentage / 100) * circumference;

    return (
        <div style={{ background: 'white', borderRadius: '16px', padding: '2rem 1.5rem', flex: 1, minWidth: '220px', textAlign: 'center', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            <h3 style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '1px', marginBottom: '0.5rem', textTransform: 'uppercase' }}>{title}</h3>
            <div style={{ fontSize: '2.25rem', fontWeight: 800, color: '#0f172a', marginBottom: '1.5rem' }}>{value}</div>

            <div style={{ position: 'relative', width: '160px', height: '90px', margin: '0 auto' }}>
                <svg width="160" height="90" viewBox="0 0 160 90">
                    {/* Background Arc */}
                    <path
                        d="M 20 80 A 60 60 0 0 1 140 80"
                        fill="none"
                        stroke="#e2e8f0"
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                    />
                    {/* Foreground Arc */}
                    <path
                        d="M 20 80 A 60 60 0 0 1 140 80"
                        fill="none"
                        stroke={color}
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
                    />
                </svg>
                {/* Percentage Text inside arc */}
                <div style={{ position: 'absolute', bottom: '10px', left: 0, right: 0, textAlign: 'center', fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
                    {Math.round(clampedPercentage)}%
                </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginTop: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: trendIsPositive ? '#059669' : '#dc2626' }}>
                {trendIsPositive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                {trendText}
            </div>
        </div>
    );
};

export default Gauge;
