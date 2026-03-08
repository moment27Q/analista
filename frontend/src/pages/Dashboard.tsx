import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Save, User, RefreshCcw, Send, AlertCircle, Activity, ArrowRight, Building2, Edit2, X, Check, Trash2, Key } from 'lucide-react';
import Gauge from '../components/Gauge';

interface DashboardData {
    gauges: {
        opex_anual: number;
        capex: number;
        opex_mensual: number;
        utilization_percent?: number;
        available_percent?: number;
    };
    total_budget?: string;
    table_data: {
        id: number;
        name: string;
        ticket_value: string;
        ot_value: string;
        monto_value: string;
    }[];
}

interface HistoryEntry {
    id: number;
    user_id: number;
    username: string;
    role: string;
    action_type: string;
    description: string;
    created_at: string;
}

const Dashboard = () => {
    const [data, setData] = useState<DashboardData | null>(null);
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<number | null>(null);
    const [deleting, setDeleting] = useState<number | null>(null);
    const [isEditingBudget, setIsEditingBudget] = useState(false);
    const [editBudgetValue, setEditBudgetValue] = useState('');
    const [savingBudget, setSavingBudget] = useState(false);
    const [isAddingBudget, setIsAddingBudget] = useState(false);
    const [addBudgetValue, setAddBudgetValue] = useState('');
    const [isAddingMember, setIsAddingMember] = useState(false);
    const [newMemberName, setNewMemberName] = useState('');
    const [addingMember, setAddingMember] = useState(false);
    const [newMemberUsername, setNewMemberUsername] = useState('');
    const [newMemberPassword, setNewMemberPassword] = useState('');
    const [savingPassword, setSavingPassword] = useState(false);
    const [changingPasswordFor, setChangingPasswordFor] = useState<number | null>(null);
    const [newPasswordValue, setNewPasswordValue] = useState('');
    const [memberToDelete, setMemberToDelete] = useState<number | null>(null);
    const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
    const [resettingAll, setResettingAll] = useState(false);
    const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const navigate = useNavigate();
    const role = localStorage.getItem('role') || 'user';

    const fetchDashboardData = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('http://localhost:3001/api/dashboard', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.status === 401 || response.status === 403) {
                handleLogout();
                return;
            }

            const result = await response.json();
            setData(result);
            if (result.total_budget) {
                setEditBudgetValue(result.total_budget);
            }
        } catch (err) {
            console.error('Error fetching data:', err);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    const fetchHistory = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('http://localhost:3001/api/dashboard/history', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const result = await response.json();
                setHistory(result.history || []);
            }
        } catch (err) {
            console.error('Error fetching history:', err);
        }
    };

    useEffect(() => {
        fetchDashboardData();
        fetchHistory();
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('token');
        navigate('/login');
    };

    const handleOpenPasswordChangeOwn = () => {
        setIsProfileDropdownOpen(false);
        // Find the user's ID from table_data based on role lookup logic or we can just send the logged-in user id if we had it.
        // But since we only have 'changingPasswordFor' we can determine their user_id.
        // Wait, the API uses changingPasswordFor = row.id. A regular user only sees their own row!
        if (role === 'admin') {
            alert('Para cambiar la contraseña de un usuario, haz clic en el botón de la llave inglesa en la fila correspondiente.');
        } else if (data && data.table_data.length > 0) {
            setChangingPasswordFor(data.table_data[0].id);
        }
    };

    const handleInputChange = (id: number, field: string, value: string) => {
        if (!data) return;
        setData({
            ...data,
            table_data: data.table_data.map(row =>
                row.id === id ? { ...row, [field]: value } : row
            )
        });
    };

    const handleSaveRow = async (row: any) => {
        const ticket = String(row.ticket_value || '').trim();
        const ot = String(row.ot_value || '').trim();
        const monto = String(row.monto_value || '').trim();

        if (!ticket || ticket === '0') {
            alert('Por favor, ingrese el ID de Ticket.');
            return;
        }
        if (!ot || ot === '0') {
            alert('Por favor, ingrese el Número de OT.');
            return;
        }
        if (!monto || monto === '0' || monto === '0.00') {
            alert('Por favor, ingrese un Monto válido.');
            return;
        }

        setSaving(row.id);
        try {
            const token = localStorage.getItem('token');
            const rowPayload = { ...row, name: row.name, clear_after_save: true };
            const response = await fetch('http://localhost:3001/api/dashboard/update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(rowPayload)
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                alert("No se pudo guardar: " + (errData.error || 'Error desconocido'));
                return;
            }

            await fetchDashboardData(true);
            await fetchHistory();
        } catch (err) {
            console.error('Failed to save', err);
            alert('Error de red al guardar.');
        } finally {
            setSaving(null);
        }
    };

    const handleSaveBudget = async () => {
        setSavingBudget(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('http://localhost:3001/api/budget/update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ total_budget: editBudgetValue })
            });

            if (response.ok) {
                if (data) {
                    setData({ ...data, total_budget: editBudgetValue });
                }
                setIsEditingBudget(false);
                await fetchDashboardData(true);
                await fetchHistory();
            } else {
                const errData = await response.json().catch(() => ({}));
                alert("No se pudo actualizar presupuesto: " + (errData.error || 'Error desconocido'));
            }
        } catch (err) {
            console.error('Failed to save budget', err);
            alert('Error de red al actualizar presupuesto.');
        } finally {
            setSavingBudget(false);
        }
    };

    const handleAddBudget = async () => {
        if (!addBudgetValue || isNaN(Number(addBudgetValue))) return;
        setSavingBudget(true);
        try {
            const token = localStorage.getItem('token');
            const currentBudget = Number(data?.total_budget) || 2450000;
            const newTotal = currentBudget + Number(addBudgetValue);

            const response = await fetch('http://localhost:3001/api/budget/update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ total_budget: newTotal.toString() })
            });

            if (response.ok) {
                if (data) {
                    setData({ ...data, total_budget: newTotal.toString() });
                }
                setIsAddingBudget(false);
                setAddBudgetValue('');
                await fetchDashboardData(true);
                await fetchHistory();
            } else {
                const errData = await response.json().catch(() => ({}));
                alert("No se pudo sumar presupuesto: " + (errData.error || 'Error desconocido'));
            }
        } catch (err) {
            console.error('Failed to add to budget', err);
            alert('Error de red al sumar presupuesto.');
        } finally {
            setSavingBudget(false);
        }
    };

    const handleAddMember = async () => {
        if (!newMemberName.trim()) return;
        setAddingMember(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('http://localhost:3001/api/dashboard/users/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ name: newMemberName.trim(), username: newMemberUsername.trim(), password: newMemberPassword })
            });

            if (response.ok) {
                const result = await response.json();
                if (data) {
                    setData({
                        ...data,
                        table_data: [...data.table_data, {
                            id: result.id,
                            name: newMemberName.trim().toUpperCase(),
                            ticket_value: '',
                            ot_value: '',
                            monto_value: ''
                        }]
                    });
                }
                setIsAddingMember(false);
                setNewMemberName('');
                setNewMemberUsername('');
                setNewMemberPassword('');
                await fetchDashboardData(true);
                await fetchHistory();
            } else {
                const errData = await response.json().catch(() => ({}));
                alert("Error al crear usuario: " + (errData.error || "Posiblemente ya existe."));
            }
        } catch (err) {
            console.error('Failed to save member', err);
            alert('Error de red al crear usuario.');
        } finally {
            setAddingMember(false);
        }
    };

    const handleDeleteMember = async (id: number) => {
        setDeleting(id);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('http://localhost:3001/api/dashboard/users/delete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ id })
            });

            if (response.ok) {
                if (data) {
                    setData({
                        ...data,
                        table_data: data.table_data.filter(row => row.id !== id)
                    });
                }
                await fetchDashboardData(true);
                await fetchHistory();
            } else {
                const errData = await response.json().catch(() => ({}));
                alert("Error al eliminar usuario: " + (errData.error || "Error desconocido"));
            }
        } catch (err) {
            console.error('Failed to delete member', err);
            alert('Error de red al eliminar usuario.');
        } finally {
            setDeleting(null);
        }
    };

    const handleSavePassword = async (id: number) => {
        if (!newPasswordValue.trim()) {
            alert('La contrasena no puede estar vacia');
            return;
        }
        setSavingPassword(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('http://localhost:3001/api/dashboard/users/password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ id, newPassword: newPasswordValue })
            });

            if (response.ok) {
                alert('Contrasena actualizada con exito.');
                setChangingPasswordFor(null);
                setNewPasswordValue('');
                await fetchDashboardData(true);
                await fetchHistory();
            } else {
                const errData = await response.json().catch(() => ({}));
                alert('Error: ' + (errData.error || 'No se pudo actualizar'));
            }
        } catch (err) {
            console.error('Failed to update password', err);
            alert('Error de red al actualizar contrasena.');
        } finally {
            setSavingPassword(false);
        }
    };
    const handleDownloadExcel = () => {
        if (!data || !data.table_data) return;

        // Create Excel XML Spreadsheet format (this forces Excel to open it correctly natively)
        let xmlString = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Bottom"/>
   <Borders/>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#000000"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <Style ss:ID="s62">
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#1c4233" ss:Pattern="Solid"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Resumen">
  <Table>
   <Column ss:Width="220"/>
   <Column ss:Width="160"/>
   <Row>
    <Cell ss:StyleID="s62"><Data ss:Type="String">Indicador</Data></Cell>
    <Cell ss:StyleID="s62"><Data ss:Type="String">Valor</Data></Cell>
   </Row>
   <Row>
    <Cell><Data ss:Type="String">OPEX ANUAL</Data></Cell>
    <Cell><Data ss:Type="String">${formatCurrency(data?.gauges?.opex_anual ?? 0)}</Data></Cell>
   </Row>
   <Row>
    <Cell><Data ss:Type="String">CAPEX</Data></Cell>
    <Cell><Data ss:Type="String">${formatCurrency(data?.gauges?.capex ?? 0)}</Data></Cell>
   </Row>
   <Row>
    <Cell><Data ss:Type="String">OPEX MENSUAL</Data></Cell>
    <Cell><Data ss:Type="String">${formatCurrency(data?.gauges?.opex_mensual ?? 0)}</Data></Cell>
   </Row>
   <Row>
    <Cell><Data ss:Type="String">PRESUPUESTO TOTAL</Data></Cell>
    <Cell><Data ss:Type="String">${formatCurrency(Number(data?.total_budget || 0))}</Data></Cell>
   </Row>
  </Table>
 </Worksheet>
 <Worksheet ss:Name="Registros del Equipo">
  <Table>
   <Column ss:Width="150"/>
   <Column ss:Width="100"/>
   <Column ss:Width="100"/>
   <Column ss:Width="80"/>
   <Row>
    <Cell ss:StyleID="s62"><Data ss:Type="String">Miembro del Equipo</Data></Cell>
    <Cell ss:StyleID="s62"><Data ss:Type="String">Ticket ID</Data></Cell>
    <Cell ss:StyleID="s62"><Data ss:Type="String">OT Number</Data></Cell>
    <Cell ss:StyleID="s62"><Data ss:Type="String">Monto ($)</Data></Cell>
   </Row>`;

        data.table_data.forEach(row => {
            const member = (row.name || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const ticket = (row.ticket_value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const ot = (row.ot_value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const monto = (row.monto_value || '0').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

            xmlString += `
   <Row>
    <Cell><Data ss:Type="String">${member}</Data></Cell>
    <Cell><Data ss:Type="String">${ticket}</Data></Cell>
    <Cell><Data ss:Type="String">${ot}</Data></Cell>
    <Cell><Data ss:Type="Number">${monto}</Data></Cell>
   </Row>`;
        });

    xmlString += `
  </Table>
 </Worksheet>
 <Worksheet ss:Name="Historial Completo">
  <Table>
   <Column ss:Width="150"/>
   <Column ss:Width="110"/>
   <Column ss:Width="130"/>
   <Column ss:Width="450"/>
   <Row>
    <Cell ss:StyleID="s62"><Data ss:Type="String">Fecha</Data></Cell>
    <Cell ss:StyleID="s62"><Data ss:Type="String">Usuario</Data></Cell>
    <Cell ss:StyleID="s62"><Data ss:Type="String">Tipo</Data></Cell>
    <Cell ss:StyleID="s62"><Data ss:Type="String">Descripcion</Data></Cell>
   </Row>`;

        history.forEach(item => {
            const created = (item.created_at || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const username = (item.username || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const actionType = (item.action_type || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const description = (item.description || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

            xmlString += `
   <Row>
    <Cell><Data ss:Type="String">${created}</Data></Cell>
    <Cell><Data ss:Type="String">${username}</Data></Cell>
    <Cell><Data ss:Type="String">${actionType}</Data></Cell>
    <Cell><Data ss:Type="String">${description}</Data></Cell>
   </Row>`;
        });

        xmlString += `
  </Table>
 </Worksheet>
</Workbook>`;

        // Create Blob and document object link to download
        const blob = new Blob([xmlString], { type: 'application/vnd.ms-excel' });
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', 'Reporte_Admin_Detallado.xls');
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const handleResetAllToZero = async () => {
        setResettingAll(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('http://localhost:3001/api/dashboard/reset', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                alert("No se pudo reiniciar: " + (errData.error || 'Error desconocido'));
                return;
            }

            await fetchDashboardData();
            await fetchHistory();
            setIsResetConfirmOpen(false);
        } catch (err) {
            console.error('Failed to reset all data', err);
            alert('Error de red al reiniciar datos.');
        } finally {
            setResettingAll(false);
        }
    };

    if (loading && !data) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
                <RefreshCw className="animate-spin" size={40} style={{ color: '#052e16', animation: 'spin 1s linear infinite' }} />
                <p style={{ marginTop: '1rem', color: '#64748b', fontWeight: 600 }}>Cargando Panel...</p>
                <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(val);
    };

    const utilizationPercent = Math.max(0, Math.min(100, data?.gauges?.utilization_percent ?? 0));
    const utilizationLabel = `${utilizationPercent.toFixed(1)}%`;
    const availablePercent = Math.max(0, Math.min(100, data?.gauges?.available_percent ?? 100 - utilizationPercent));

    const opexMonthlyValue = data?.gauges?.opex_mensual ?? 0;
    const opexAnnualValue = data?.gauges?.opex_anual ?? 0;
    const capexValue = data?.gauges?.capex ?? 0;

    const opexAnnualPercentage = utilizationPercent;
    const capexPercentage = availablePercent;
    const opexMonthlyPercentage = utilizationPercent;

    return (
        <div style={{ minHeight: '100vh', background: '#f1f5f9', color: '#0f172a', fontFamily: 'Inter, sans-serif' }}>

            {/* Top Navbar */}
            <nav style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '1rem 2rem', background: '#ffffff', borderBottom: '1px solid #e2e8f0'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '1.25rem', color: '#0f172a' }}>
                    <div style={{ background: '#1c4233', color: 'white', padding: '0.35rem', borderRadius: '6px', display: 'flex' }}>
                        <Building2 size={20} />
                    </div>
                    Centro Financiero
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', position: 'relative' }}>

                    <div
                        onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                        style={{ width: '38px', height: '38px', background: '#1e293b', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', cursor: 'pointer', transition: 'transform 0.2s', userSelect: 'none' }}
                        title="Perfil"
                        onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                        onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    >
                        <User size={18} />
                    </div>

                    {/* Profile Dropdown */}
                    {isProfileDropdownOpen && (
                        <div style={{
                            position: 'absolute',
                            top: '110%',
                            right: 0,
                            background: 'white',
                            border: '1px solid #e2e8f0',
                            borderRadius: '12px',
                            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)',
                            minWidth: '200px',
                            overflow: 'hidden',
                            zIndex: 50
                        }}>
                            <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Cuenta</div>
                                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>Rol: {role}</div>
                            </div>

                            <div style={{ padding: '0.5rem' }}>
                                <button
                                    onClick={handleOpenPasswordChangeOwn}
                                    style={{ width: '100%', textAlign: 'left', padding: '10px 12px', background: 'transparent', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: '#334155', fontSize: '0.85rem', fontWeight: 500, transition: 'background 0.2s' }}
                                    onMouseOver={(e) => e.currentTarget.style.background = '#f1f5f9'}
                                    onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                                >
                                    <Key size={16} /> Cambiar contraseña
                                </button>

                                <button
                                    onClick={handleLogout}
                                    style={{ width: '100%', textAlign: 'left', padding: '10px 12px', background: 'transparent', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444', fontSize: '0.85rem', fontWeight: 500, transition: 'background 0.2s', marginTop: '4px' }}
                                    onMouseOver={(e) => e.currentTarget.style.background = '#fee2e2'}
                                    onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                                    Cerrar sesión
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </nav>

            <main style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>

                {/* GAUGES SECTION */}
                <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem' }}>
                    <Gauge
                        title="OPEX ANUAL"
                        value={formatCurrency(opexAnnualValue)}
                        percentage={opexAnnualPercentage}
                        color="#1c4233"
                        trendText={`${utilizationLabel} usado`}
                        trendIsPositive={utilizationPercent <= 100}
                    />
                    <Gauge
                        title="CAPEX"
                        value={formatCurrency(capexValue)}
                        percentage={capexPercentage}
                        color="#8b5cf6"
                        trendText={`${availablePercent.toFixed(1)}% disponible`}
                        trendIsPositive={capexValue > 0}
                    />
                    <Gauge
                        title="OPEX MENSUAL"
                        value={formatCurrency(opexMonthlyValue)}
                        percentage={opexMonthlyPercentage}
                        color="#10b981"
                        trendText={`${utilizationLabel} del presupuesto`}
                        trendIsPositive={utilizationPercent <= 100}
                    />
                </div>

                {/* TOTAL BUDGET BANNER */}
                <div style={{ background: '#1c4233', borderRadius: '12px', padding: '1.5rem 2.5rem', color: 'white', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                    <div>
                        <h2 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#e2e8f0', marginBottom: '0.25rem', letterSpacing: '0.5px' }}>Estado del Presupuesto Total</h2>
                        {isEditingBudget ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                                <span style={{ fontSize: '1.5rem', fontWeight: 800 }}>$</span>
                                <input
                                    type="number"
                                    value={editBudgetValue}
                                    onChange={(e) => setEditBudgetValue(e.target.value)}
                                    style={{
                                        background: 'rgba(255,255,255,0.1)', border: '1px solid #a7f3d0',
                                        borderRadius: '8px', padding: '8px 12px', color: 'white',
                                        fontSize: '1.5rem', fontWeight: 800, width: '150px', outline: 'none'
                                    }}
                                    autoFocus
                                />
                                <button
                                    onClick={handleSaveBudget}
                                    disabled={savingBudget}
                                    style={{ background: '#10b981', border: 'none', color: 'white', padding: '8px', borderRadius: '8px', cursor: 'pointer', display: 'flex' }}
                                >
                                    {savingBudget ? <RefreshCw size={20} className="animate-spin" /> : <Check size={20} />}
                                </button>
                                <button
                                    onClick={() => { setIsEditingBudget(false); setEditBudgetValue(data?.total_budget || '0'); }}
                                    style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '8px', borderRadius: '8px', cursor: 'pointer', display: 'flex' }}
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.25rem' }}>
                                <div style={{ fontSize: '2.25rem', fontWeight: 800, letterSpacing: '-0.5px' }}>
                                    {formatCurrency(Number(data?.total_budget || 2450000))}
                                </div>
                                {role === 'admin' && (
                                    <button
                                        onClick={() => setIsEditingBudget(true)}
                                        style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', padding: '4px', cursor: 'pointer', display: 'flex', transition: 'color 0.2s' }}
                                        onMouseOver={(e) => e.currentTarget.style.color = 'white'}
                                        onMouseOut={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}
                                        title="Editar Presupuesto"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                )}
                            </div>
                        )}
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.5rem' }}>Última actualización hoy a las 09:42 AM</div>
                    </div>

                    <div style={{ width: '45%' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-end', gap: '1rem', marginBottom: '0.5rem' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '1px', color: '#cbd5e1', fontStyle: 'italic' }}>UTILIZACIÓN</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{utilizationLabel}</div>
                        </div>
                        <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.15)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ width: `${utilizationPercent}%`, height: '100%', background: '#ffffff', borderRadius: '4px' }}></div>
                        </div>
                    </div>

                    {role === 'admin' && (
                        isAddingBudget ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#e2e8f0' }}>+</span>
                                <input
                                    type="number"
                                    placeholder="Monto a sumar"
                                    value={addBudgetValue}
                                    onChange={(e) => setAddBudgetValue(e.target.value)}
                                    style={{
                                        background: 'rgba(255,255,255,0.1)', border: '1px solid #10b981',
                                        borderRadius: '8px', padding: '8px 12px', color: 'white',
                                        fontSize: '1rem', fontWeight: 600, width: '120px', outline: 'none'
                                    }}
                                    autoFocus
                                />
                                <button
                                    onClick={handleAddBudget}
                                    disabled={savingBudget}
                                    style={{ background: '#10b981', color: 'white', border: 'none', padding: '10px 12px', borderRadius: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                    title="Sumar al presupuesto"
                                >
                                    {savingBudget ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
                                </button>
                                <button
                                    onClick={() => { setIsAddingBudget(false); setAddBudgetValue(''); }}
                                    style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', padding: '10px 12px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    onClick={() => setIsAddingBudget(true)}
                                    style={{ background: 'white', color: '#0f172a', border: 'none', padding: '10px 16px', borderRadius: '8px', fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                                >
                                    <RefreshCcw size={16} /> Actualizar Presupuesto
                                </button>
                                <button
                                    onClick={() => setIsResetConfirmOpen(true)}
                                    style={{ background: '#ef4444', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '8px', fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                                >
                                    <AlertCircle size={16} /> Reiniciar Todo a 0
                                </button>
                            </div>
                        )
                    )}
                </div>

                {/* BOTTOM GRID */}
                <div style={{ display: 'flex', gap: '1.5rem' }}>

                    {/* LEFT PANEL: EXPENSE ENTRY */}
                    <div style={{ flex: 2, background: 'white', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Registro de Gastos del Equipo</h2>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#334155', background: '#f1f5f9', padding: '4px 10px', borderRadius: '16px' }}>OPERACIONES</span>
                        </div>

                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <th style={{ padding: '0.75rem 0', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.5px' }}>MIEMBRO DEL EQUIPO</th>
                                    <th style={{ padding: '0.75rem 0', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.5px' }}>ID DE TICKET</th>
                                    <th style={{ padding: '0.75rem 0', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.5px' }}>NÚMERO DE OT</th>
                                    <th style={{ padding: '0.75rem 0', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.5px' }}>MONTO ($)</th>
                                    <th style={{ padding: '0.75rem 0', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.5px', textAlign: 'right' }}>ACCIÓN</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data?.table_data.map((row) => {
                                    const words = row.name.trim().split(' ');
                                    const initials = words.length > 1
                                        ? words[0][0] + words[1][0]
                                        : words[0][0];

                                    return (
                                        <tr key={row.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                                            <td style={{ padding: '1.25rem 0', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ width: '30px', height: '30px', background: '#f1f5f9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#0f172a', fontSize: '0.8rem', textTransform: 'uppercase' }}>
                                                    {initials}
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#0f172a', lineHeight: 1.2, textTransform: 'capitalize' }}>{words[0].toLowerCase()}</span>
                                                    {words[1] && <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#0f172a', lineHeight: 1.2, textTransform: 'capitalize' }}>{words.slice(1).join(' ').toLowerCase()}</span>}
                                                </div>
                                            </td>
                                            <td style={{ padding: '1rem 1rem 1rem 0' }}>
                                                <input
                                                    type="text"
                                                    placeholder="TK-..."
                                                    value={row.ticket_value || ''}
                                                    onChange={(e) => handleInputChange(row.id, 'ticket_value', e.target.value)}
                                                    style={{ width: '100%', minWidth: '80px', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.85rem', color: '#64748b', background: '#f8fafc', outline: 'none' }}
                                                />
                                            </td>
                                            <td style={{ padding: '1rem 1rem 1rem 0' }}>
                                                <input
                                                    type="text"
                                                    placeholder="OT-..."
                                                    value={row.ot_value || ''}
                                                    onChange={(e) => handleInputChange(row.id, 'ot_value', e.target.value)}
                                                    style={{ width: '100%', minWidth: '80px', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.85rem', color: '#64748b', background: '#f8fafc', outline: 'none' }}
                                                />
                                            </td>
                                            <td style={{ padding: '1rem 1rem 1rem 0' }}>
                                                <input
                                                    type="text"
                                                    placeholder="0.00"
                                                    value={row.monto_value || ''}
                                                    onChange={(e) => handleInputChange(row.id, 'monto_value', e.target.value)}
                                                    style={{ width: '100%', minWidth: '80px', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.85rem', color: '#64748b', background: '#f8fafc', outline: 'none' }}
                                                />
                                            </td>
                                            <td style={{ padding: '1rem 0', textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                                                {changingPasswordFor === row.id ? (
                                                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                                        <input
                                                            type="password"
                                                            placeholder="Nueva clave"
                                                            value={newPasswordValue}
                                                            onChange={(e) => setNewPasswordValue(e.target.value)}
                                                            style={{ width: '110px', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.8rem', outline: 'none' }}
                                                            autoFocus
                                                        />
                                                        <button
                                                            onClick={() => handleSavePassword(row.id)}
                                                            disabled={savingPassword}
                                                            style={{ background: '#10b981', color: 'white', border: 'none', width: '28px', height: '28px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                                            title="Guardar contraseña"
                                                        >
                                                            {savingPassword ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                                                        </button>
                                                        <button
                                                            onClick={() => { setChangingPasswordFor(null); setNewPasswordValue(''); }}
                                                            disabled={savingPassword}
                                                            style={{ background: '#e2e8f0', color: '#475569', border: 'none', width: '28px', height: '28px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                                            title="Cancelar"
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <button
                                                            onClick={() => { setChangingPasswordFor(row.id); setNewPasswordValue(''); }}
                                                            disabled={saving === row.id || deleting === row.id}
                                                            style={{ background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0', width: '32px', height: '32px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: (saving === row.id || deleting === row.id) ? 0.7 : 1 }}
                                                            title="Cambiar contraseña"
                                                        >
                                                            <Key size={14} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleSaveRow(row)}
                                                            disabled={saving === row.id || deleting === row.id}
                                                            style={{ background: '#1c4233', color: 'white', border: 'none', width: '32px', height: '32px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: (saving === row.id || deleting === row.id) ? 0.7 : 1 }}
                                                            title="Guardar fila"
                                                        >
                                                            {saving === row.id ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                                                        </button>
                                                        {role === 'admin' && (
                                                            <button
                                                                onClick={() => setMemberToDelete(row.id)}
                                                                disabled={saving === row.id || deleting === row.id}
                                                                style={{ background: '#fee2e2', color: '#ef4444', border: 'none', width: '32px', height: '32px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: (saving === row.id || deleting === row.id) ? 0.7 : 1 }}
                                                                title="Eliminar usuario"
                                                            >
                                                                {deleting === row.id ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                                            </button>
                                                        )}
                                                    </>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}

                                {/* Add Team Member Row */}
                                {role === 'admin' && isAddingMember && (
                                    <tr style={{ background: '#f8fafc' }}>
                                        <td colSpan={4} style={{ padding: '1rem 0' }}>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <input
                                                    type="text"
                                                    placeholder="Nombre Completo..."
                                                    value={newMemberName}
                                                    onChange={(e) => setNewMemberName(e.target.value)}
                                                    style={{ width: '40%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.9rem', color: '#0f172a', fontWeight: 500, outline: 'none' }}
                                                    autoFocus
                                                />
                                                <input
                                                    type="text"
                                                    placeholder="Usuario de acceso..."
                                                    value={newMemberUsername}
                                                    onChange={(e) => setNewMemberUsername(e.target.value)}
                                                    style={{ width: '30%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.9rem', color: '#0f172a', fontWeight: 500, outline: 'none' }}
                                                />
                                                <input
                                                    type="password"
                                                    placeholder="Contraseña..."
                                                    value={newMemberPassword}
                                                    onChange={(e) => setNewMemberPassword(e.target.value)}
                                                    style={{ width: '30%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.9rem', color: '#0f172a', fontWeight: 500, outline: 'none' }}
                                                />
                                            </div>
                                        </td>
                                        <td style={{ padding: '1rem 0', textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end', height: '62px', alignItems: 'center' }}>
                                            <button
                                                onClick={handleAddMember}
                                                disabled={addingMember}
                                                style={{ background: '#10b981', color: 'white', border: 'none', width: '32px', height: '32px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                            >
                                                {addingMember ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                                            </button>
                                            <button
                                                onClick={() => { setIsAddingMember(false); setNewMemberName(''); setNewMemberUsername(''); setNewMemberPassword(''); }}
                                                style={{ background: '#e2e8f0', color: '#475569', border: 'none', width: '32px', height: '32px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                            >
                                                <X size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>

                        {role === 'admin' && !isAddingMember && (
                            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center' }}>
                                <button
                                    onClick={() => setIsAddingMember(true)}
                                    style={{ background: 'transparent', border: '1px dashed #cbd5e1', color: '#64748b', fontWeight: 600, fontSize: '0.8rem', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s', width: '100%' }}
                                    onMouseOver={(e) => { e.currentTarget.style.color = '#0f172a'; e.currentTarget.style.borderColor = '#94a3b8'; e.currentTarget.style.background = '#f8fafc'; }}
                                    onMouseOut={(e) => { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.background = 'transparent'; }}
                                >
                                    + Añadir Miembro al Equipo
                                </button>
                            </div>
                        )}
                    </div>

                    {/* RIGHT PANEL: HISTORY */}
                    <div style={{ flex: 1, background: 'transparent', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                        <div style={{ background: 'white', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Historial</h2>
                                <span
                                    onClick={() => setIsHistoryModalOpen(true)}
                                    style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0f172a', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'color 0.2s' }}
                                    onMouseOver={(e) => e.currentTarget.style.color = '#3b82f6'}
                                    onMouseOut={(e) => e.currentTarget.style.color = '#0f172a'}
                                >
                                    Ver Todo <ArrowRight size={14} style={{ marginLeft: '4px' }} />
                                </span>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {history.length === 0 ? (
                                    <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem', padding: '1rem 0' }}>
                                        No hay acciones recientes.
                                    </div>
                                ) : history.map((item) => {

                                    let icon = <Activity size={16} />;
                                    let bg = '#f1f5f9';
                                    let color = '#64748b';

                                    if (item.action_type === 'Edit Row') {
                                        icon = <Edit2 size={16} />;
                                        bg = '#eff6ff';
                                        color = '#1d4ed8';
                                    } else if (item.action_type === 'Budget') {
                                        icon = <Building2 size={16} />;
                                        bg = '#dcfce3';
                                        color = '#166534';
                                    } else if (item.action_type === 'Create User') {
                                        icon = <User size={16} />;
                                        bg = '#f3e8ff';
                                        color = '#6b21a8';
                                    } else if (item.action_type === 'Delete User') {
                                        icon = <Trash2 size={16} />;
                                        bg = '#fee2e2';
                                        color = '#ef4444';
                                    } else if (item.action_type === 'Password') {
                                        icon = <Key size={16} />;
                                        bg = '#fef3c7';
                                        color = '#b45309';
                                    } else if (item.action_type === 'Reset') {
                                        icon = <RefreshCcw size={16} />;
                                        bg = '#fee2e2';
                                        color = '#b91c1c';
                                    }

                                    const dateObj = new Date(item.created_at);
                                    const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' • ' + dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

                                    return (
                                        <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', border: '1px solid #f8fafc', borderRadius: '12px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ width: '36px', height: '36px', minWidth: '36px', borderRadius: '8px', background: bg, color: color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    {icon}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a' }}>{item.description}</div>
                                                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px', fontWeight: 500 }}>
                                                        {formattedDate} • {item.username}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <button onClick={handleDownloadExcel} style={{ width: '100%', background: '#ffffff', border: '1px solid #e2e8f0', color: '#0f172a', fontWeight: 700, padding: '14px', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)' }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                            Descargar como Excel
                        </button>
                    </div>

                </div>
            </main>

            {/* Custom Delete Confirmation Modal */}
            {memberToDelete !== null && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(15, 23, 42, 0.4)',
                    backdropFilter: 'blur(4px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999
                }}>
                    <div style={{
                        background: 'white',
                        padding: '2rem',
                        borderRadius: '16px',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                        width: '100%',
                        maxWidth: '400px',
                        textAlign: 'center'
                    }}>
                        <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '50%',
                            background: '#fee2e2',
                            color: '#ef4444',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 1.5rem auto'
                        }}>
                            <AlertCircle size={24} />
                        </div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>Eliminar Usuario</h3>
                        <p style={{ color: '#64748b', fontSize: '0.95rem', marginBottom: '2rem', lineHeight: 1.5 }}>
                            {'\u00bfEst\u00e1s seguro de que deseas eliminar este usuario y todos sus datos asociados? Esta acci\u00f3n no se puede deshacer.'}
                        </p>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button
                                onClick={() => setMemberToDelete(null)}
                                style={{ flex: 1, padding: '12px', background: '#f1f5f9', color: '#475569', fontWeight: 600, border: 'none', borderRadius: '10px', cursor: 'pointer' }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => {
                                    handleDeleteMember(memberToDelete);
                                    setMemberToDelete(null);
                                }}
                                style={{ flex: 1, padding: '12px', background: '#ef4444', color: 'white', fontWeight: 600, border: 'none', borderRadius: '10px', cursor: 'pointer' }}
                            >
                                {'S\u00ed, eliminar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reset Confirmation Modal */}
            {isResetConfirmOpen && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(15, 23, 42, 0.4)',
                    backdropFilter: 'blur(4px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999
                }}>
                    <div style={{
                        background: 'white',
                        padding: '2rem',
                        borderRadius: '16px',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                        width: '100%',
                        maxWidth: '460px',
                        textAlign: 'center'
                    }}>
                        <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '50%',
                            background: '#fee2e2',
                            color: '#ef4444',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 1.5rem auto'
                        }}>
                            <AlertCircle size={24} />
                        </div>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>Reiniciar Todo a 0</h3>
                        <p style={{ color: '#64748b', fontSize: '0.95rem', marginBottom: '2rem', lineHeight: 1.5 }}>
                            Esta accion pondra en 0 el presupuesto total y todos los montos de la tabla. No se podra revertir.
                        </p>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button
                                onClick={() => setIsResetConfirmOpen(false)}
                                disabled={resettingAll}
                                style={{ flex: 1, padding: '12px', background: '#f1f5f9', color: '#475569', fontWeight: 600, border: 'none', borderRadius: '10px', cursor: 'pointer' }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleResetAllToZero}
                                disabled={resettingAll}
                                style={{ flex: 1, padding: '12px', background: '#ef4444', color: 'white', fontWeight: 700, border: 'none', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                            >
                                {resettingAll ? <RefreshCw size={16} className="animate-spin" /> : <AlertCircle size={16} />}
                                {resettingAll ? 'Reiniciando...' : 'Si, reiniciar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Full History Modal */}
            {isHistoryModalOpen && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(15, 23, 42, 0.4)',
                    backdropFilter: 'blur(4px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999
                }}>
                    <div style={{
                        background: 'white',
                        padding: '2rem',
                        borderRadius: '16px',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                        width: '100%',
                        maxWidth: '600px',
                        maxHeight: '80vh',
                        display: 'flex',
                        flexDirection: 'column'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>Registro de Acciones (Historial)</h3>
                            <button
                                onClick={() => setIsHistoryModalOpen(false)}
                                style={{ background: '#f1f5f9', color: '#64748b', border: 'none', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div style={{ overflowY: 'auto', paddingRight: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1 }}>
                            {history.length === 0 ? (
                                <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem', padding: '2rem 0' }}>
                                    No hay acciones registradas.
                                </div>
                            ) : history.map((item) => {
                                let icon = <Activity size={16} />;
                                let bg = '#f1f5f9';
                                let color = '#64748b';

                                if (item.action_type === 'Edit Row') {
                                    icon = <Edit2 size={16} />; bg = '#eff6ff'; color = '#1d4ed8';
                                } else if (item.action_type === 'Budget') {
                                    icon = <Building2 size={16} />; bg = '#dcfce3'; color = '#166534';
                                } else if (item.action_type === 'Create User') {
                                    icon = <User size={16} />; bg = '#f3e8ff'; color = '#6b21a8';
                                } else if (item.action_type === 'Delete User') {
                                    icon = <Trash2 size={16} />; bg = '#fee2e2'; color = '#ef4444';
                                } else if (item.action_type === 'Password') {
                                    icon = <Key size={16} />; bg = '#fef3c7'; color = '#b45309';
                                } else if (item.action_type === 'Reset') {
                                    icon = <RefreshCcw size={16} />; bg = '#fee2e2'; color = '#b91c1c';
                                }

                                const dateObj = new Date(item.created_at);
                                const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' • ' + dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

                                return (
                                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', border: '1px solid #e2e8f0', borderRadius: '12px', background: '#f8fafc' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                            <div style={{ width: '42px', height: '42px', minWidth: '42px', borderRadius: '10px', background: bg, color: color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                {icon}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>{item.description}</div>
                                                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px', fontWeight: 500 }}>
                                                    {item.username} • {formattedDate}
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 700, padding: '4px 8px', borderRadius: '6px', background: bg, color: color, textTransform: 'uppercase' }}>
                                            {item.action_type}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default Dashboard;


