import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, Building2, ShieldAlert } from 'lucide-react';

const ChangePassword = () => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        if (password !== confirmPassword) {
            setError('Las contraseñas no coinciden');
            setLoading(false);
            return;
        }

        if (password.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres');
            setLoading(false);
            return;
        }

        try {
            const token = sessionStorage.getItem('token');
            const response = await fetch('/api/users/change-password-own', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ newPassword: password })
            });

            const data = await response.json().catch(() => ({}));

            if (response.ok) {
                // Return to home or dashboard since password is now changed
                navigate('/home');
            } else {
                setError(data.error || 'Error al cambiar la contraseña');
            }
        } catch (err) {
            setError('Error de red al actualizar la contraseña.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc', color: '#0f172a', position: 'relative', overflow: 'hidden' }}>
            <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.4, pointerEvents: 'none', zIndex: 0,
                backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
                backgroundSize: '24px 24px'
            }}></div>

            <nav style={{
                position: 'relative', zIndex: 10,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '1.5rem 4rem', background: '#ffffff', borderBottom: '1px solid #e2e8f0'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '1.25rem', color: '#0f172a' }}>
                    <div style={{ background: '#052e16', color: 'white', padding: '0.2rem', borderRadius: '4px', display: 'flex' }}>
                        <Building2 size={24} />
                    </div>
                    Control
                </div>
            </nav>

            <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 10, padding: '2rem' }}>
                <div style={{
                    background: '#ffffff', width: '100%', maxWidth: '440px',
                    borderRadius: '16px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)',
                    borderTop: '6px solid #eab308', overflow: 'hidden'
                }}>
                    <div style={{ padding: '2.5rem 2.5rem 2rem 2.5rem' }}>
                        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                            <div style={{ display: 'inline-flex', background: '#fef3c7', padding: '12px', borderRadius: '50%', color: '#d97706', marginBottom: '1rem' }}>
                                <ShieldAlert size={32} />
                            </div>
                            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>Actualización Necesaria</h1>
                            <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Por seguridad, debes crear una nueva contraseña. Será válida por 6 meses.</p>
                        </div>

                        {error && (
                            <div style={{ background: '#fef2f2', color: '#ef4444', padding: '12px', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.9rem', textAlign: 'center', border: '1px solid #fca5a5' }}>
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <div>
                                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.5rem' }}>Nueva Contraseña</label>
                                <div style={{ position: 'relative' }}>
                                    <Lock size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        placeholder="Min 6 caracteres"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        minLength={6}
                                        style={{
                                            width: '100%', padding: '12px 44px 12px 44px',
                                            background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px',
                                            fontSize: '0.95rem', color: '#0f172a', outline: 'none'
                                        }}
                                    />
                                    <div
                                        onClick={() => setShowPassword(!showPassword)}
                                        style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', cursor: 'pointer', display: 'flex' }}
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.5rem' }}>Confirmar Contraseña</label>
                                <div style={{ position: 'relative' }}>
                                    <Lock size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        placeholder="Repetir contraseña"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        required
                                        style={{
                                            width: '100%', padding: '12px 44px 12px 44px',
                                            background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px',
                                            fontSize: '0.95rem', color: '#0f172a', outline: 'none'
                                        }}
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                style={{
                                    marginTop: '0.5rem', background: '#eab308', color: '#ffffff', border: 'none',
                                    padding: '14px', borderRadius: '8px', fontWeight: 700, fontSize: '1rem',
                                    cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px',
                                    transition: 'background 0.2s'
                                }}
                                onMouseOver={(e) => e.currentTarget.style.background = '#ca8a04'}
                                onMouseOut={(e) => e.currentTarget.style.background = '#eab308'}
                            >
                                {loading ? 'Actualizando...' : 'Guardar y Continuar'}
                            </button>
                        </form>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default ChangePassword;
