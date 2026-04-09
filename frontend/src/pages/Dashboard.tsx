import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Save, User, RefreshCcw, Send, AlertCircle, Activity, ArrowRight, Building2, Edit2, X, Check, Trash2, Key, AlertTriangle, PlayCircle, StopCircle } from 'lucide-react';
import Gauge from '../components/Gauge';
import { io } from 'socket.io-client';

interface DashboardData {
    gauges: {
        opex_anual: number;
        opex_anual_budget?: number;
        opex_anual_percent?: number;
        opex_anual_spent?: number;
        capex: number;
        capex_spent?: number;
        opex_mensual_total: number;
        opex_plazavea: number;
        opex_vivanda: number;
        opex_makro: number;
        total_available_percent?: number;
        available_percent?: number;
        alerts_90?: string[];
        active_period?: {
            id: number;
            start_date: string;
            start_opex_anual: number;
            start_opex_plazavea: number;
            start_opex_vivanda: number;
            start_opex_makro: number;
            start_capex: number;
        } | null;
        budgets: {
            plazavea: number;
            vivanda: number;
            makro: number;
            capex: number;
            opex_anual?: number;
        };
    };
    team_expenses?: any[];
    total_budget?: string;
    table_data: {
        id: number;
        name: string;
        ticket_value: string;
        ot_value: string;
        monto_value: string;
        entidad: string;
        activos: string;
        expense_date?: string;
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
    const [isBudgetsModalOpen, setIsBudgetsModalOpen] = useState(false);
    const [budgetsForm, setBudgetsForm] = useState({ total: '', plazavea: '', vivanda: '', makro: '', capex: '', opex_anual: '' });
    const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
    const [startingPeriod, setStartingPeriod] = useState(false);
    const [endingPeriod, setEndingPeriod] = useState(false);
    const navigate = useNavigate();
    const role = sessionStorage.getItem('role') || 'user';
    
    // Add a ref to track which rows are currently being edited locally
    const dirtyRowsRef = useRef<Set<number>>(new Set());

    const fetchDashboardData = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const token = sessionStorage.getItem('token');
            const response = await fetch('/api/dashboard', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.status === 401 || response.status === 403) {
                handleLogout();
                return;
            }

            const result = await response.json();
            
            setData(prevData => {
                // If it's our first fetch, just set it
                if (!prevData) {
                    if (result.total_budget && !isEditingBudget && !isAddingBudget) {
                        setEditBudgetValue(result.total_budget);
                    }
                    return result;
                }

                // If polling, merge table_data keeping local edits for dirty rows
                const mergedTableData = result.table_data.map((serverRow: any) => {
                    if (dirtyRowsRef.current.has(serverRow.id)) {
                        const localRow = prevData.table_data.find(r => r.id === serverRow.id);
                        return localRow ? { ...localRow } : serverRow;
                    }
                    return serverRow;
                });

                // Do not update the editBudgetValue state if the user is currently typing in the budget fields.
                // Using a functional state update guarantees we read the absolute freshest boolean states.
                setIsEditingBudget(currentIsEditing => {
                    setIsAddingBudget(currentIsAdding => {
                        if (result.total_budget && !currentIsEditing && !currentIsAdding) {
                            setEditBudgetValue(result.total_budget);
                        }
                        return currentIsAdding;
                    });
                    return currentIsEditing;
                });

                return {
                    ...result,
                    table_data: mergedTableData
                };
            });
        } catch (err) {
            console.error('Error fetching data:', err);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    const fetchHistory = async () => {
        try {
            const token = sessionStorage.getItem('token');
            const response = await fetch('/api/dashboard/history', {
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

        const socket = io({ path: '/api/socket.io' });
        socket.on('dashboard_update', () => {
            fetchDashboardData(true);
            fetchHistory();
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    const handleLogout = () => {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('role');
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
        dirtyRowsRef.current.add(id);
        if (!data) return;
        setData({
            ...data,
            table_data: data.table_data.map(row =>
                row.id === id ? { ...row, [field]: value } : row
            )
        });
    };

    const isEdwinOrCapex = (row: any) => {
        return (row.name || '').toUpperCase() === 'EDWIN' || row.entidad === 'CAPEX';
    };

    const handleSaveRow = async (row: any) => {
        const ticket = String(row.ticket_value || '').trim();
        const ot = String(row.ot_value || '').trim();
        const monto = String(row.monto_value || '').trim();
        const needsTicket = !isEdwinOrCapex(row);

        if (needsTicket && (!ticket || ticket === '0')) {
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

        const isEdwin = (row.name || '').toUpperCase() === 'EDWIN';
        if (!isEdwin && !row.entidad) {
            alert('❌ Por favor, despliega la lista y selecciona la ENTIDAD (Plaza Vea, Vivanda, Makro, o CAPEX) antes de pulsar el botón Guardar.');
            return;
        }

        setSaving(row.id);
        try {
            const token = sessionStorage.getItem('token');
            const rowPayload = { 
                ...row, 
                name: row.name, 
                entidad: isEdwinOrCapex(row) ? 'CAPEX' : row.entidad,
                clear_after_save: true,
                expense_date: row.expense_date || new Date().toISOString().split('T')[0]
            };
            const response = await fetch('/api/dashboard/update', {
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

            // Remove from dirty rows since it's saved
            dirtyRowsRef.current.delete(row.id);

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
            const token = sessionStorage.getItem('token');
            const response = await fetch('/api/budget/update', {
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
            const token = sessionStorage.getItem('token');
            const currentBudget = Number(data?.total_budget) || 2450000;
            const newTotal = currentBudget + Number(addBudgetValue);

            const response = await fetch('/api/budget/update', {
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
            const token = sessionStorage.getItem('token');
            const response = await fetch('/api/dashboard/users/create', {
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
                            monto_value: '',
                            entidad: '',
                            activos: ''
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
        if (!window.confirm("Esta accion eliminara al usuario permanentemente y borrara todo su registro asociado al Dashboard. ¿Deseas proceder?")) {
            return;
        }
        
        setDeleting(id);
        try {
            const token = sessionStorage.getItem('token');
            const response = await fetch('/api/dashboard/users/delete', {
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
            const token = sessionStorage.getItem('token');
            const response = await fetch('/api/dashboard/users/password', {
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
    const handleDownloadExcel = async () => {
        if (!data || !data.table_data) return;

        let periodHistory: any[] = [];
        try {
            const token = sessionStorage.getItem('token');
            const res = await fetch('/api/period/history', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const result = await res.json();
                periodHistory = result.periods || [];
            }
        } catch (e) {
            console.warn('Error fetching period history', e);
        }

        const gauges = data.gauges;
        const budgets = gauges?.budgets || { plazavea: 0, vivanda: 0, makro: 0, capex: 0, opex_anual: 0 } as any;
        const opexAnualBudg = budgets?.opex_anual ?? 0;
        const opexAnualRem = gauges?.opex_anual ?? 0;
        const opexAnualSpent = (gauges as any)?.opex_anual_spent ?? 0;
        const capexBudg = budgets?.capex ?? 0;
        const capexSpent = (gauges as any)?.capex_spent ?? 0;
        const capexRem = gauges?.capex ?? 0;

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
  <Style ss:ID="s63">
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Bold="1"/>
   <Interior ss:Color="#dcfce7" ss:Pattern="Solid"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Resumen">
  <Table>
   <Column ss:Width="160"/>
   <Column ss:Width="140"/>
   <Column ss:Width="140"/>
   <Column ss:Width="140"/>`;

        const createResumenBlock = (startDate: string, endDate: string, opexAnualBudg: number, opexAnualSpent: number, opexAnualRem: number, pvBudg: number, pvSpent: number, pvRem: number, viBudg: number, viSpent: number, viRem: number, mkBudg: number, mkSpent: number, mkRem: number, capexBudg: number, capexSpent: number, capexRem: number) => {
            return `
   <Row>
    <Cell ss:StyleID="s63"><Data ss:Type="String">FECHA INICIO: ${startDate}</Data></Cell>
    <Cell ss:StyleID="s63"><Data ss:Type="String"></Data></Cell>
    <Cell ss:StyleID="s63"><Data ss:Type="String">FECHA FIN: ${endDate}</Data></Cell>
    <Cell ss:StyleID="s63"><Data ss:Type="String"></Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="s62"><Data ss:Type="String">Concepto</Data></Cell>
    <Cell ss:StyleID="s62"><Data ss:Type="String">Presupuesto Asignado</Data></Cell>
    <Cell ss:StyleID="s62"><Data ss:Type="String">Gastado (Actual)</Data></Cell>
    <Cell ss:StyleID="s62"><Data ss:Type="String">Restante</Data></Cell>
   </Row>
   <Row>
    <Cell><Data ss:Type="String">OPEX Anual</Data></Cell>
    <Cell><Data ss:Type="Number">${opexAnualBudg}</Data></Cell>
    <Cell><Data ss:Type="Number">${opexAnualSpent}</Data></Cell>
    <Cell><Data ss:Type="Number">${opexAnualRem}</Data></Cell>
   </Row>
   <Row>
    <Cell><Data ss:Type="String">OPEX Plaza Vea</Data></Cell>
    <Cell><Data ss:Type="Number">${pvBudg}</Data></Cell>
    <Cell><Data ss:Type="Number">${pvSpent}</Data></Cell>
    <Cell><Data ss:Type="Number">${pvRem}</Data></Cell>
   </Row>
   <Row>
    <Cell><Data ss:Type="String">OPEX Vivanda</Data></Cell>
    <Cell><Data ss:Type="Number">${viBudg}</Data></Cell>
    <Cell><Data ss:Type="Number">${viSpent}</Data></Cell>
    <Cell><Data ss:Type="Number">${viRem}</Data></Cell>
   </Row>
   <Row>
    <Cell><Data ss:Type="String">OPEX Makro</Data></Cell>
    <Cell><Data ss:Type="Number">${mkBudg}</Data></Cell>
    <Cell><Data ss:Type="Number">${mkSpent}</Data></Cell>
    <Cell><Data ss:Type="Number">${mkRem}</Data></Cell>
   </Row>
   <Row>
    <Cell><Data ss:Type="String">CAPEX Anual</Data></Cell>
    <Cell><Data ss:Type="Number">${capexBudg}</Data></Cell>
    <Cell><Data ss:Type="Number">${capexSpent}</Data></Cell>
    <Cell><Data ss:Type="Number">${capexRem}</Data></Cell>
   </Row>
   <Row></Row>`;
        };

        // First historical periods (sorted normally id ASC to be chronological bottom to top, wait periodHistory is usually DESC, so let's reverse to show oldest first or keep DESC?)
        // Let's use periodHistory directly
        periodHistory.slice().reverse().forEach(period => {
            const startD = (period.start_date || '').split('T')[0];
            const endD = (period.end_date || '').split('T')[0];
            const opBudg = Number(period.start_opex_anual || 0);
            const opRem = Number(period.end_opex_anual || 0);
            const opSpent = opBudg - opRem; // This is a rough estimation of spent for old records that didn't record spent OPEX Anual.
            
            xmlString += createResumenBlock(
                startD, endD,
                opBudg, opSpent, opRem,
                Number(period.start_opex_plazavea || 0), Number(period.spent_plazavea || 0), Number(period.end_opex_plazavea || 0),
                Number(period.start_opex_vivanda || 0), Number(period.spent_vivanda || 0), Number(period.end_opex_vivanda || 0),
                Number(period.start_opex_makro || 0), Number(period.spent_makro || 0), Number(period.end_opex_makro || 0),
                Number(period.start_capex || 0), Number(period.spent_capex || 0), Number(period.end_capex || 0)
            );
        });

        // Finally current period
        const currentStart = gauges?.active_period ? (gauges.active_period.start_date || '').split('T')[0] : 'Actual';
        const currentEnd = 'En curso';
        xmlString += createResumenBlock(
            currentStart, currentEnd,
            opexAnualBudg, opexAnualSpent, opexAnualRem,
            budgets.plazavea, gauges?.opex_plazavea ?? 0, budgets.plazavea - (gauges?.opex_plazavea ?? 0),
            budgets.vivanda, gauges?.opex_vivanda ?? 0, budgets.vivanda - (gauges?.opex_vivanda ?? 0),
            budgets.makro, gauges?.opex_makro ?? 0, budgets.makro - (gauges?.opex_makro ?? 0),
            capexBudg, capexSpent, capexRem
        );

        xmlString += `
  </Table>
 </Worksheet>`;

        // Historial de Balances (Flat table of all past periods)
        if (periodHistory.length > 0) {
            xmlString += `
 <Worksheet ss:Name="Historial de Balances">
  <Table>
   <Row>
    <Cell ss:StyleID="s62"><Data ss:Type="String">ID</Data></Cell>
    <Cell ss:StyleID="s62"><Data ss:Type="String">Inicio</Data></Cell>
    <Cell ss:StyleID="s62"><Data ss:Type="String">Fin</Data></Cell>
    <Cell ss:StyleID="s62"><Data ss:Type="String">OPEX Anual (Fin)</Data></Cell>
    <Cell ss:StyleID="s62"><Data ss:Type="String">Gasto Plaza Vea</Data></Cell>
    <Cell ss:StyleID="s62"><Data ss:Type="String">Gasto Vivanda</Data></Cell>
    <Cell ss:StyleID="s62"><Data ss:Type="String">Gasto Makro</Data></Cell>
    <Cell ss:StyleID="s62"><Data ss:Type="String">Gasto Total Mensual</Data></Cell>
    <Cell ss:StyleID="s62"><Data ss:Type="String">Gasto CAPEX</Data></Cell>
    <Cell ss:StyleID="s62"><Data ss:Type="String">CAPEX (Fin)</Data></Cell>
   </Row>`;

            periodHistory.forEach(period => {
                const gPv = Number(period.spent_plazavea || 0);
                const gViv = Number(period.spent_vivanda || 0);
                const gMak = Number(period.spent_makro || 0);
                const gTotal = gPv + gViv + gMak;
                xmlString += `
   <Row>
    <Cell><Data ss:Type="String">Periodo ${period.id}</Data></Cell>
    <Cell><Data ss:Type="String">${(period.start_date || '').split('T')[0]}</Data></Cell>
    <Cell><Data ss:Type="String">${(period.end_date || '').split('T')[0]}</Data></Cell>
    <Cell><Data ss:Type="Number">${period.end_opex_anual || 0}</Data></Cell>
    <Cell><Data ss:Type="Number">${gPv}</Data></Cell>
    <Cell><Data ss:Type="Number">${gViv}</Data></Cell>
    <Cell><Data ss:Type="Number">${gMak}</Data></Cell>
    <Cell><Data ss:Type="Number">${gTotal}</Data></Cell>
    <Cell><Data ss:Type="Number">${period.spent_capex || 0}</Data></Cell>
    <Cell><Data ss:Type="Number">${period.end_capex || 0}</Data></Cell>
   </Row>`;
            });

            xmlString += `
  </Table>
 </Worksheet>`;
        }

        xmlString += `
 <Worksheet ss:Name="Registros del Equipo">
  <Table>
   <Column ss:Width="100"/>
   <Column ss:Width="150"/>
   <Column ss:Width="100"/>
   <Column ss:Width="100"/>
   <Column ss:Width="120"/>
   <Column ss:Width="140"/>
   <Column ss:Width="80"/>
   <Row>
    <Cell ss:StyleID="s62"><Data ss:Type="String">Fecha</Data></Cell>
    <Cell ss:StyleID="s62"><Data ss:Type="String">Miembro del Equipo</Data></Cell>
    <Cell ss:StyleID="s62"><Data ss:Type="String">Ticket ID</Data></Cell>
    <Cell ss:StyleID="s62"><Data ss:Type="String">OT Number</Data></Cell>
    <Cell ss:StyleID="s62"><Data ss:Type="String">Entidad</Data></Cell>
    <Cell ss:StyleID="s62"><Data ss:Type="String">Activos</Data></Cell>
    <Cell ss:StyleID="s62"><Data ss:Type="String">Monto (S/.)</Data></Cell>
   </Row>`;

        (data.team_expenses || []).forEach((row: any) => {
            const esc = (s: string) => (s ? String(s) : '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const formattedDate = row.expense_date ? new Date(row.expense_date).toISOString().split('T')[0] : '';
            xmlString += `
   <Row>
    <Cell><Data ss:Type="String">${esc(formattedDate)}</Data></Cell>
    <Cell><Data ss:Type="String">${esc(row.name)}</Data></Cell>
    <Cell><Data ss:Type="String">${esc(row.ticket_number)}</Data></Cell>
    <Cell><Data ss:Type="String">${esc(row.ot_number)}</Data></Cell>
    <Cell><Data ss:Type="String">${esc(row.entidad)}</Data></Cell>
    <Cell><Data ss:Type="String">${esc(row.activos)}</Data></Cell>
    <Cell><Data ss:Type="Number">${row.monto || 0}</Data></Cell>
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
            const esc = (s: string) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            xmlString += `
   <Row>
    <Cell><Data ss:Type="String">${esc(item.created_at)}</Data></Cell>
    <Cell><Data ss:Type="String">${esc(item.username)}</Data></Cell>
    <Cell><Data ss:Type="String">${esc(item.action_type)}</Data></Cell>
    <Cell><Data ss:Type="String">${esc(item.description)}</Data></Cell>
   </Row>`;
        });

        xmlString += `
  </Table>
 </Worksheet>
</Workbook>`;

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

    const handleOpenBudgetsModal = () => {
        setBudgetsForm({
            total: data?.total_budget || '0',
            plazavea: data?.gauges?.budgets?.plazavea?.toString() || '0',
            vivanda: data?.gauges?.budgets?.vivanda?.toString() || '0',
            makro: data?.gauges?.budgets?.makro?.toString() || '0',
            capex: data?.gauges?.budgets?.capex?.toString() || '0',
            opex_anual: (data?.gauges?.budgets as any)?.opex_anual?.toString() || '0'
        });
        setIsBudgetsModalOpen(true);
    };

    const handleSaveBudgetsForm = async () => {
        setSavingBudget(true);
        try {
            const token = sessionStorage.getItem('token');
            const response = await fetch('/api/budget/update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    total_budget: budgetsForm.total,
                    opex_plazavea_budget: budgetsForm.plazavea,
                    opex_vivanda_budget: budgetsForm.vivanda,
                    opex_makro_budget: budgetsForm.makro,
                    capex_annual_budget: budgetsForm.capex,
                    opex_anual_budget: budgetsForm.opex_anual
                })
            });

            if (response.ok) {
                setIsBudgetsModalOpen(false);
                await fetchDashboardData(true);
                await fetchHistory();
            } else {
                const errData = await response.json().catch(() => ({}));
                alert("No se pudo actualizar presupuestos: " + (errData.error || 'Error desconocido'));
            }
        } catch (err) {
            console.error('Failed to save budgets', err);
            alert('Error al actualizar presupuestos.');
        } finally {
            setSavingBudget(false);
        }
    };

    const handleResetAllToZero = async () => {
        setResettingAll(true);
        try {
            const token = sessionStorage.getItem('token');
            const response = await fetch('/api/dashboard/reset', {
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

    const handleStartPeriod = async () => {
        if (!window.confirm('¿Confirmas el INICIO DE MES? Se tomará el estado actual como punto de partida del balance.')) return;
        setStartingPeriod(true);
        try {
            const token = sessionStorage.getItem('token');
            const res = await fetch('/api/period/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                alert('✅ Inicio de mes registrado correctamente.');
                await fetchDashboardData(true);
                await fetchHistory();
            } else {
                const err = await res.json().catch(() => ({}));
                alert('Error: ' + (err.error || 'No se pudo iniciar el período'));
            }
        } catch (e) {
            alert('Error de red.');
        } finally {
            setStartingPeriod(false);
        }
    };

    const handleEndPeriod = async () => {
        if (!window.confirm('¿Confirmas el FIN DE MES? Se cerrará el período y podrás descargar el balance en el Excel.')) return;
        setEndingPeriod(true);
        try {
            const token = sessionStorage.getItem('token');
            const res = await fetch('/api/period/end', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                alert('✅ Fin de mes registrado. Descarga el Excel para ver el balance completo.');
                await fetchDashboardData(true);
                await fetchHistory();
            } else {
                const err = await res.json().catch(() => ({}));
                alert('Error: ' + (err.error || 'No se pudo cerrar el período'));
            }
        } catch (e) {
            alert('Error de red.');
        } finally {
            setEndingPeriod(false);
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc', color: '#0f172a', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '2rem' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>
                    Hola, {sessionStorage.getItem('display_name')?.split(' ')[0] || 'Usuario'}
                </h1>
                <RefreshCw className="animate-spin" size={40} style={{ color: '#052e16', animation: 'spin 1s linear infinite' }} />
                <p style={{ marginTop: '1rem', color: '#64748b', fontWeight: 600 }}>Cargando Panel...</p>
                <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', minimumFractionDigits: 0 }).format(val);
    };

    const totalAvailablePercent = Math.max(0, Math.min(100, data?.gauges?.total_available_percent ?? 100));
    const availableLabel = `${totalAvailablePercent.toFixed(1)}%`;

    const opexPlazaVea = data?.gauges?.opex_plazavea ?? 0;
    const opexVivanda = data?.gauges?.opex_vivanda ?? 0;
    const opexMakro = data?.gauges?.opex_makro ?? 0;
    const capexValue = data?.gauges?.capex ?? 0;

    const budgets = data?.gauges?.budgets || { plazavea: 1, vivanda: 1, makro: 1, capex: 1 };
    
    // Plaza Vea Gauge Stats: Show Progress % and "Remaining" as main value
    const pvRemaining = budgets.plazavea - opexPlazaVea;
    const plazaveaPercent = budgets.plazavea > 0 ? Math.max(0, Math.min(100, (opexPlazaVea / budgets.plazavea) * 100)) : 0;

    // Vivanda Gauge Stats
    const viRemaining = budgets.vivanda - opexVivanda;
    const vivandaPercent = budgets.vivanda > 0 ? Math.max(0, Math.min(100, (opexVivanda / budgets.vivanda) * 100)) : 0;

    // Makro Gauge Stats
    const mkRemaining = budgets.makro - opexMakro;
    const makroPercent = budgets.makro > 0 ? Math.max(0, Math.min(100, (opexMakro / budgets.makro) * 100)) : 0;

    // CAPEX Gauge Stats
    const caRemaining = capexValue; // Backend already calculates budget - spent
    const caSpent = budgets.capex - caRemaining;
    const capexPercent = budgets.capex > 0 ? Math.max(0, Math.min(100, (caSpent / budgets.capex) * 100)) : 0;

    const opexAnnualPercentage = data?.gauges?.opex_anual_percent ?? 100;
    // OPEX anual remaining value (budget - spent)
    const opexAnualRemainingValue = data?.gauges?.opex_anual ?? 0;
    const opexAnualBudgetValue = (data?.gauges?.budgets as any)?.opex_anual ?? 0;
    const alerts90 = (data?.gauges?.alerts_90 || []).filter((a: string) => !dismissedAlerts.has(a));
    const activePeriod = data?.gauges?.active_period;

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
                    Control
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                    <Gauge
                        title="OPEX ANUAL"
                        value={formatCurrency(opexAnualRemainingValue)}
                        percentage={Math.max(0, Math.min(100, (data?.gauges?.opex_anual_spent ?? 0) / (opexAnualBudgetValue || 1) * 100))}
                        color="#1c4233"
                        trendText={`Gasto: ${formatCurrency(data?.gauges?.opex_anual_spent ?? 0)}`}
                        trendIsPositive={opexAnnualPercentage > 20}
                    />
                    <Gauge
                        title="OPEX - PLAZA VEA"
                        value={formatCurrency(pvRemaining)}
                        percentage={plazaveaPercent}
                        color="#10b981"
                        trendText={`Presupuesto: ${formatCurrency(budgets.plazavea)}`}
                        trendIsPositive={pvRemaining > 0}
                    />
                    <Gauge
                        title="OPEX - VIVANDA"
                        value={formatCurrency(viRemaining)}
                        percentage={vivandaPercent}
                        color="#f59e0b"
                        trendText={`Presupuesto: ${formatCurrency(budgets.vivanda)}`}
                        trendIsPositive={viRemaining > 0}
                    />
                    <Gauge
                        title="OPEX - MAKRO"
                        value={formatCurrency(mkRemaining)}
                        percentage={makroPercent}
                        color="#ef4444"
                        trendText={`Presupuesto: ${formatCurrency(budgets.makro)}`}
                        trendIsPositive={mkRemaining > 0}
                    />
                    <Gauge
                        title="CAPEX"
                        value={formatCurrency(capexValue)}
                        percentage={capexPercent}
                        color="#8b5cf6"
                        trendText={`Gasto: ${formatCurrency(caSpent)}`}
                        trendIsPositive={capexValue > 0}
                    />
                </div>

                {/* 90% ALERTS */}
                {alerts90.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                        {alerts90.map((entity: string) => (
                            <div key={entity} style={{ background: '#fffbeb', border: '1px solid #f59e0b', borderRadius: 10, padding: '0.75rem 1.2rem', display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#92400e' }}>
                                <AlertTriangle size={18} style={{ flexShrink: 0, color: '#d97706' }} />
                                <span style={{ flex: 1, fontWeight: 600 }}>
                                    ⚠️ <strong>Cuidado:</strong> se ha alcanzado el <strong>90% de fondos</strong> de <strong>{entity}</strong>. Considera recargar el presupuesto.
                                </span>
                                <button
                                    onClick={() => setDismissedAlerts(prev => new Set([...prev, entity]))}
                                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#92400e', display: 'flex', alignItems: 'center' }}
                                    title="Cerrar alerta"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* TOTAL BUDGET BANNER */}
                <div style={{ background: '#1c4233', borderRadius: '12px', padding: '1.5rem 2.5rem', color: 'white', marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '2rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                    <div style={{ minWidth: '250px' }}>
                        <h2 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#e2e8f0', marginBottom: '0.25rem', letterSpacing: '0.5px' }}>Estado del Presupuesto Total</h2>
                        {isEditingBudget ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                                <span style={{ fontSize: '1.5rem', fontWeight: 800 }}>S/.</span>
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

                    <div style={{ flex: 1, minWidth: '280px' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-end', gap: '1rem', marginBottom: '0.5rem' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '1px', color: '#cbd5e1', fontStyle: 'italic' }}>PORCENTAJE DISPONIBLE</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{availableLabel}</div>
                        </div>
                        <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.15)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ width: `${totalAvailablePercent}%`, height: '100%', background: '#10b981', borderRadius: '4px' }}></div>
                        </div>
                    </div>

                    {role === 'admin' && (
                        isAddingBudget ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
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
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                <button
                                    onClick={handleOpenBudgetsModal}
                                    style={{ background: 'white', color: '#0f172a', border: 'none', padding: '10px 16px', borderRadius: '8px', fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                                >
                                    <Edit2 size={16} /> Configurar Presupuestos
                                </button>
                                <button
                                    onClick={() => setIsAddingBudget(true)}
                                    style={{ background: 'white', color: '#0f172a', border: 'none', padding: '10px 16px', borderRadius: '8px', fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                                >
                                    <RefreshCcw size={16} /> Aumentar Total
                                </button>
                                {activePeriod ? (
                                    <button
                                        onClick={handleEndPeriod}
                                        disabled={endingPeriod}
                                        style={{ background: '#ef4444', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '8px', fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                                    >
                                        {endingPeriod ? <RefreshCw size={16} className="animate-spin" /> : <StopCircle size={16} />}
                                        {endingPeriod ? 'Cerrando...' : 'FIN DE MES'}
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleStartPeriod}
                                        disabled={startingPeriod}
                                        style={{ background: '#10b981', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '8px', fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                                    >
                                        {startingPeriod ? <RefreshCw size={16} className="animate-spin" /> : <PlayCircle size={16} />}
                                        {startingPeriod ? 'Iniciando...' : 'INICIO DE MES'}
                                    </button>
                                )}
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
                                    <th style={{ padding: '0.75rem 0', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.5px' }}>FECHA</th>
                                    <th style={{ padding: '0.75rem 0', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.5px' }}>MIEMBRO DEL EQUIPO</th>
                                    <th style={{ padding: '0.75rem 0', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.5px' }}>ID DE TICKET</th>
                                    <th style={{ padding: '0.75rem 0', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.5px' }}>NÚMERO DE OT</th>
                                    <th style={{ padding: '0.75rem 0', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.5px' }}>ENTIDAD</th>
                                    <th style={{ padding: '0.75rem 0', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.5px' }}>ACTIVOS</th>
                                    <th style={{ padding: '0.75rem 0', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.5px' }}>MONTO (S/.)</th>
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
                                            <td style={{ padding: '1rem 1rem 1rem 0' }}>
                                                <input
                                                    type="date"
                                                    value={row.expense_date || new Date().toISOString().split('T')[0]}
                                                    onChange={(e) => handleInputChange(row.id, 'expense_date', e.target.value)}
                                                    style={{ width: '100%', minWidth: '120px', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.85rem', color: '#64748b', background: '#f8fafc', outline: 'none' }}
                                                />
                                            </td>
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
                                                {!isEdwinOrCapex(row) && (
                                                    <input
                                                        type="text"
                                                        placeholder="TK-..."
                                                        value={row.ticket_value || ''}
                                                        onChange={(e) => handleInputChange(row.id, 'ticket_value', e.target.value)}
                                                        style={{ width: '100%', minWidth: '80px', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.85rem', color: '#64748b', background: '#f8fafc', outline: 'none' }}
                                                    />
                                                )}
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
                                                {(row.name || '').toUpperCase() === 'EDWIN' ? (
                                                    <div style={{ padding: '8px 12px', background: '#ede9fe', borderRadius: '6px', fontWeight: 700, color: '#7c3aed', border: '1px solid #c4b5fd', fontSize: '0.85rem' }}>
                                                        CAPEX
                                                    </div>
                                                ) : (
                                                    <select
                                                        value={row.entidad || ''}
                                                        onChange={(e) => handleInputChange(row.id, 'entidad', e.target.value)}
                                                        style={{ width: '100%', minWidth: '100px', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.85rem', color: '#64748b', background: '#f8fafc', outline: 'none' }}
                                                    >
                                                        <option value="">[Elegir...]</option>
                                                        <option value="Plaza Vea">Plaza Vea</option>
                                                        <option value="Vivanda">Vivanda</option>
                                                        <option value="Makro">Makro</option>
                                                        <option value="CAPEX">CAPEX (Admin)</option>
                                                    </select>
                                                )}
                                            </td>
                                            <td style={{ padding: '1rem 1rem 1rem 0' }}>
                                                <select
                                                    value={row.activos || ''}
                                                    onChange={(e) => handleInputChange(row.id, 'activos', e.target.value)}
                                                    style={{ width: '100%', minWidth: '150px', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.85rem', color: '#64748b', background: '#f8fafc', outline: 'none' }}
                                                >
                                                    <option value="">[Elegir...]</option>
                                                    <option value="Tableros Eléctricos">Tableros Eléctricos</option>
                                                    <option value="UPS">UPS</option>
                                                    <option value="Grupo Electrógenos">Grupo Electrógenos</option>
                                                    <option value="Media Tensión">Media Tensión</option>
                                                    <option value="Iluminación">Iluminación</option>
                                                    <option value="ITSE">ITSE</option>
                                                    <option value="Cableado y/o circuitos eléctricos">Cableado y/o circuitos eléctricos</option>
                                                </select>
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
                                        <td colSpan={5} style={{ padding: '1rem 0' }}>
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

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '400px', overflowY: 'auto', paddingRight: '8px' }}>
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
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                            Descargar como Excel
                        </button>
                    </div>

                </div>
            </main>

            {/* Budgets Configuration Modal */}
            {isBudgetsModalOpen && (
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
                        maxWidth: '500px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#dcfce7', color: '#166534', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Building2 size={24} />
                            </div>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Configurar Presupuestos</h3>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#1c4233', marginBottom: '4px' }}>OPEX Anual (presupuesto independiente) (S/.)</label>
                                <input type="number" min="0" value={budgetsForm.opex_anual} onChange={e => setBudgetsForm({...budgetsForm, opex_anual: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>Presupuesto Total (S/.)</label>
                                <input type="number" min="0" value={budgetsForm.total} onChange={e => setBudgetsForm({...budgetsForm, total: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#10b981', marginBottom: '4px' }}>OPEX Plaza Vea (S/.)</label>
                                    <input type="number" min="0" value={budgetsForm.plazavea} onChange={e => setBudgetsForm({...budgetsForm, plazavea: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#f59e0b', marginBottom: '4px' }}>OPEX Vivanda (S/.)</label>
                                    <input type="number" min="0" value={budgetsForm.vivanda} onChange={e => setBudgetsForm({...budgetsForm, vivanda: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} />
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#ef4444', marginBottom: '4px' }}>OPEX Makro (S/.)</label>
                                    <input type="number" min="0" value={budgetsForm.makro} onChange={e => setBudgetsForm({...budgetsForm, makro: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#8b5cf6', marginBottom: '4px' }}>CAPEX Anual (S/.)</label>
                                    <input type="number" min="0" value={budgetsForm.capex} onChange={e => setBudgetsForm({...budgetsForm, capex: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} />
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button
                                onClick={() => setIsBudgetsModalOpen(false)}
                                disabled={savingBudget}
                                style={{ flex: 1, padding: '12px', background: '#f1f5f9', color: '#475569', fontWeight: 600, border: 'none', borderRadius: '10px', cursor: 'pointer' }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSaveBudgetsForm}
                                disabled={savingBudget}
                                style={{ flex: 1, padding: '12px', background: '#1c4233', color: 'white', fontWeight: 700, border: 'none', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                            >
                                {savingBudget ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                                {savingBudget ? 'Guardando...' : 'Guardar Presupuestos'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

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


