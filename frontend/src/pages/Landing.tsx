import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    BarChart3,
    PieChart,
    FileText,
    CheckCircle2,
    Building2
} from 'lucide-react';
import fghImage from './imagen/fgh.jpg';
import analyticsImage from './imagen/image.png';

interface SummaryData {
    total_budget: number;
    total_spent: number;
    remaining: number;
}

const Landing = () => {
    const navigate = useNavigate();
    const [summary, setSummary] = useState<SummaryData>({
        total_budget: 0,
        total_spent: 0,
        remaining: 0
    });

    useEffect(() => {
        const fetchSummary = async () => {
            try {
                const response = await fetch('/api/summary');
                if (!response.ok) return;
                const data = await response.json();
                setSummary({
                    total_budget: Number(data.total_budget) || 0,
                    total_spent: Number(data.total_spent) || 0,
                    remaining: Number(data.remaining) || 0
                });
            } catch (err) {
                console.error('Error loading summary:', err);
            }
        };

        fetchSummary();
    }, []);

    const formatCurrency = (value: number) =>
        new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(value);

    return (
        <div className="layout-container" style={{ background: '#f8fafc', color: '#0f172a' }}>

            {/* Navbar */}
            <nav style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1.5rem 4rem',
                borderBottom: '1px solid #e2e8f0',
                background: '#ffffff'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '1.25rem', color: '#0f172a' }}>
                    <div style={{ background: '#052e16', color: 'white', padding: '0.25rem', borderRadius: '4px' }}>
                        <Building2 size={24} />
                    </div>
                    Control
                </div>
                <div style={{ display: 'flex', gap: '2rem', alignItems: 'center', fontWeight: 500 }}>
                    <button
                        onClick={() => navigate('/login')}
                        style={{
                            background: '#052e16',
                            color: 'white',
                            border: 'none',
                            padding: '10px 24px',
                            borderRadius: '6px',
                            fontWeight: 600,
                            cursor: 'pointer'
                        }}
                    >
                        Iniciar Sesión
                    </button>
                </div>
            </nav>

            <main style={{ padding: '0 4rem' }}>

                {/* Hero Section */}
                <section style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6rem 0' }}>
                    <div style={{ maxWidth: '50%' }}>

                        <h1 style={{ fontSize: '3.5rem', fontWeight: 800, lineHeight: 1.1, marginTop: '1.5rem', marginBottom: '1.5rem', color: '#020617' }}>
                            Control de <br /> Presupuesto y <br />Gastos de <br />Mantenimiento<br />
                            <span style={{ color: '#059669' }}>Eléctrico</span>
                        </h1>

                        <p style={{ fontSize: '1.1rem', color: '#475569', marginBottom: '2rem', lineHeight: 1.6, maxWidth: '90%' }}>
                            Plataforma centralizada para gestionar su presupuesto anual. Registre OTs, controle el gasto OPEX/CAPEX por sede y obtenga reportes claros al instante.
                        </p>

                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            <button
                                onClick={() => navigate('/login')}
                                style={{
                                    background: '#052e16',
                                    color: 'white',
                                    border: 'none',
                                    padding: '14px 28px',
                                    borderRadius: '6px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    fontSize: '1rem'
                                }}
                            >
                                Iniciar Sesión
                            </button>

                        </div>
                    </div>

                    {/* Hero Image / Placeholder Widget */}
                    <div style={{
                        width: '45%',
                        height: '400px',
                        background: 'transparent',
                        borderRadius: '16px',
                        boxShadow: '0 20px 40px -10px rgba(0,0,0,0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden'
                    }}>
                        <img src={fghImage} alt="Dashboard Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                </section>

                {/* Floating Stats Bar */}
                <section style={{
                    display: 'flex',
                    gap: '1.5rem',
                    marginBottom: '6rem'
                }}>
                    {[
                        { label: 'PRESUPUESTO TOTAL', value: formatCurrency(summary.total_budget), color: '#0f172a' },
                        { label: 'TOTAL GASTADO', value: formatCurrency(summary.total_spent), color: '#059669' },
                        { label: 'RESTANTE', value: formatCurrency(summary.remaining), color: '#0f172a' }
                    ].map((stat, i) => (
                        <div key={i} style={{
                            flex: 1,
                            background: 'white',
                            padding: '1.5rem',
                            borderRadius: '12px',
                            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
                        }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.5rem' }}>{stat.label}</div>
                            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: stat.color }}>{stat.value}</div>
                        </div>
                    ))}
                </section>

                {/* Features Grid */}
                <section style={{ marginBottom: '6rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '1px', color: '#64748b' }}>
                        CAPACIDADES DE LA PLATAFORMA
                    </span>
                    <h2 style={{ fontSize: '2.5rem', fontWeight: 700, marginTop: '0.5rem', marginBottom: '1rem', maxWidth: '600px' }}>
                        Diseñado para la gestión real del equipo
                    </h2>
                    <p style={{ color: '#475569', marginBottom: '3rem', maxWidth: '700px', lineHeight: 1.6 }}>
                        Simplifique la administración de su área con herramientas creadas específicamente para el mantenimiento eléctrico de sus sedes.
                    </p>

                    <div style={{ display: 'flex', gap: '2rem' }}>
                        {[
                            { icon: <BarChart3 />, title: 'Control OPEX/CAPEX', desc: 'Desglose automático de su presupuesto por Plaza Vea, Vivanda y Makro. Conozca el saldo restante en vivo.' },
                            { icon: <PieChart />, title: 'Registro de OTs y Tickets', desc: 'Ingreso directo de gastos diarios por cada miembro de su equipo, manteniendo un historial organizado.' },
                            { icon: <FileText />, title: 'Reportes en Excel', desc: 'Exporte todos los movimientos y balances de mes con un solo clic para sus cierres financieros.' }
                        ].map((feat, i) => (
                            <div key={i} style={{
                                flex: 1,
                                background: 'white',
                                padding: '2.5rem 2rem',
                                borderRadius: '16px',
                                border: '1px solid #f1f5f9'
                            }}>
                                <div style={{ background: '#ecfdf5', color: '#059669', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
                                    {feat.icon}
                                </div>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>{feat.title}</h3>
                                <p style={{ color: '#64748b', lineHeight: 1.6, fontSize: '0.95rem' }}>{feat.desc}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Detail Sections */}
                <section style={{ display: 'flex', alignItems: 'center', gap: '6rem', marginBottom: '6rem' }}>
                    <div style={{
                        flex: 1,
                        height: '350px',
                        background: 'white',
                        borderRadius: '16px',
                        border: '1px solid #e2e8f0',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1'
                    }}>
                        <img
                            src={analyticsImage}
                            alt="Analytics Preview"
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover'
                            }}
                        />
                    </div>
                    <div style={{ flex: 1 }}>
                        <h2 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '1.5rem' }}>Monitoreo Constante del Equipo</h2>
                        <p style={{ color: '#475569', lineHeight: 1.6, marginBottom: '2rem' }}>
                            Supervise exactamente en qué se invierte el presupuesto del área, revise el avance de consumos por entidad y tome el control absoluto.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {['Límites de gasto por Sedes', 'Historial de Cierres de Mes', 'Trazabilidad de gastos por Usuario'].map((item, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#334155', fontWeight: 500 }}>
                                    <CheckCircle2 size={20} color="#059669" />
                                    {item}
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

            </main>



        </div>
    );
};

export default Landing;
