import React from 'react';

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
        <div style={{ 
            background: 'white', 
            borderRadius: '20px', 
            padding: '2rem 1.5rem', 
            flex: 1, 
            minWidth: '220px', 
            textAlign: 'center', 
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.02)',
            border: '1px solid #f1f5f9',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            transition: 'transform 0.2s ease-out'
        }}>
            <div>
                <h3 style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', letterSpacing: '1.5px', marginBottom: '0.5rem', textTransform: 'uppercase' }}>{title}</h3>
                <div style={{ fontSize: '2rem', fontWeight: 900, color: '#0f172a', marginBottom: '1.25rem', letterSpacing: '-0.5px' }}>{value}</div>
            </div>

            <div style={{ position: 'relative', width: '160px', height: '90px', margin: '0.5rem auto' }}>
                <svg width="160" height="90" viewBox="0 0 160 90">
                    {/* Background Arc */}
                    <path
                        d="M 20 80 A 60 60 0 0 1 140 80"
                        fill="none"
                        stroke="#f1f5f9"
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
                        style={{ transition: 'stroke-dashoffset 1.5s cubic-bezier(0.4, 0, 0.2, 1)' }}
                    />
                </svg>
                {/* Percentage Text inside arc */}
                <div style={{ position: 'absolute', bottom: '15px', left: 0, right: 0, textAlign: 'center' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>
                        {Math.round(clampedPercentage)}<span style={{ fontSize: '0.9rem', color: '#94a3b8' }}>%</span>
                    </div>
                </div>
            </div>

            <div style={{ 
                marginTop: '1rem', 
                paddingTop: '1rem',
                borderTop: '1px solid #f8fafc',
                fontSize: '0.8rem', 
                fontWeight: 600, 
                color: '#64748b',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color }}></span>
                    {trendText}
                </div>
                <div style={{ fontSize: '0.7rem', color: (trendIsPositive || clampedPercentage < 100) ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                    {trendIsPositive ? '✓ Dentro del presupuesto' : '⚠ Exceso de gastos'}
                </div>
            </div>
        </div>
    );
};

export default Gauge;
