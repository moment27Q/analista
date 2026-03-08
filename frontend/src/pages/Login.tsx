import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AtSign, Lock, Eye, EyeOff, Building2 } from 'lucide-react';

const Login = () => {
    const [username, setUsername] = useState('admin');
    const [password, setPassword] = useState('password123');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const trimmedUsername = username.trim();
            const trimmedPassword = password.trim();
            const response = await fetch('http://localhost:3001/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: trimmedUsername, password: trimmedPassword })
            });

            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('role', data.role);
                navigate('/home');
            } else {
                setError(data.error || 'Error de inicio de sesión');
            }
        } catch (err) {
            setError('Error de red. ¿Está funcionando el servidor?');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc', color: '#0f172a', position: 'relative', overflow: 'hidden' }}>

            {/* Dot Pattern Background Overlay */}
            <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.4, pointerEvents: 'none', zIndex: 0,
                backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
                backgroundSize: '24px 24px'
            }}></div>

            {/* Navbar */}
            <nav style={{
                position: 'relative', zIndex: 10,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '1.5rem 4rem', background: '#ffffff', borderBottom: '1px solid #e2e8f0'
            }}>
                <div
                    onClick={() => navigate('/')}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '1.25rem', color: '#0f172a', cursor: 'pointer', transition: 'opacity 0.2s' }}
                    onMouseOver={(e) => e.currentTarget.style.opacity = '0.8'}
                    onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
                >
                    <div style={{ background: '#052e16', color: 'white', padding: '0.2rem', borderRadius: '4px', display: 'flex' }}>
                        <Building2 size={24} />
                    </div>
                    Centro Financiero
                </div>
                <div style={{ display: 'flex', gap: '2rem', fontSize: '0.9rem', color: '#334155', fontWeight: 500 }}>
                    <span
                        style={{ cursor: 'pointer', transition: 'color 0.2s' }}
                        onMouseOver={(e) => e.currentTarget.style.color = '#0f172a'}
                        onMouseOut={(e) => e.currentTarget.style.color = '#334155'}
                    >
                    </span>
                </div>
            </nav>

            {/* Main Content */}
            <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 10, padding: '2rem' }}>

                {/* Login Card */}
                <div style={{
                    background: '#ffffff', width: '100%', maxWidth: '440px',
                    borderRadius: '16px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)',
                    borderTop: '6px solid #052e16', overflow: 'hidden'
                }}>
                    <div style={{ padding: '2.5rem 2.5rem 2rem 2.5rem' }}>
                        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>Bienvenido de nuevo</h1>
                            <p style={{ color: '#64748b', fontSize: '0.95rem' }}>Ingrese sus credenciales para acceder a su panel</p>
                        </div>

                        {error && (
                            <div style={{ background: '#fef2f2', color: '#ef4444', padding: '12px', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.9rem', textAlign: 'center', border: '1px solid #fca5a5' }}>
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                            {/* Email Input */}
                            <div>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.5rem' }}>Usuario</label>
                                <div style={{ position: 'relative' }}>
                                    <AtSign size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                    <input
                                        type="text"
                                        placeholder="admin"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        required
                                        style={{
                                            width: '100%', padding: '12px 16px 12px 44px',
                                            background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px',
                                            fontSize: '0.95rem', color: '#0f172a', outline: 'none', transition: 'all 0.2s'
                                        }}
                                        onFocus={(e) => e.target.style.borderColor = '#052e16'}
                                        onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                                    />
                                </div>
                            </div>

                            {/* Password Input */}
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>Contraseña</label>
                                    
                                </div>
                                <div style={{ position: 'relative' }}>
                                    <Lock size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        style={{
                                            width: '100%', padding: '12px 44px 12px 44px',
                                            background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px',
                                            fontSize: '0.95rem', color: '#0f172a', outline: 'none', transition: 'all 0.2s'
                                        }}
                                        onFocus={(e) => e.target.style.borderColor = '#052e16'}
                                        onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                                    />
                                    <div
                                        onClick={() => setShowPassword(!showPassword)}
                                        style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', cursor: 'pointer', display: 'flex' }}
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </div>
                                </div>
                            </div>

                            {/* Remember Device */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <input type="checkbox" id="remember" style={{ width: '16px', height: '16px', accentColor: '#052e16', cursor: 'pointer' }} />
                                <label htmlFor="remember" style={{ fontSize: '0.85rem', color: '#475569', cursor: 'pointer' }}>Recordar este dispositivo</label>
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={loading}
                                style={{
                                    marginTop: '0.5rem', background: '#1b4332', color: 'white', border: 'none',
                                    padding: '14px', borderRadius: '8px', fontWeight: 600, fontSize: '1rem',
                                    cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px',
                                    transition: 'background 0.2s'
                                }}
                                onMouseOver={(e) => e.currentTarget.style.background = '#052e16'}
                                onMouseOut={(e) => e.currentTarget.style.background = '#1b4332'}
                            >
                                {loading ? 'Autenticando...' : 'Iniciar Sesión ➔'}
                            </button>
                        </form>


                    </div>
                </div>


            </main>



        </div>
    );
};

export default Login;
