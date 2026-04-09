import { useEffect, useState, useRef, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, ArrowRight, Building2, ClipboardList, Edit2, FileText, Key, LayoutDashboard, LogOut, RefreshCcw, Send, Trash2, AlertTriangle, Save, X, DollarSign } from 'lucide-react';
import Gauge from '../components/Gauge';
import { io } from 'socket.io-client';

interface DashboardRow {
  id: number;
  name: string;
  ticket_value: string;
  ot_value: string;
  monto_value: string;
  entidad: string;
  activos: string;
}

interface DashboardResponse {
    gauges?: {
      opex_anual: number;
      opex_anual_budget: number;
      opex_anual_percent: number;
      opex_anual_spent: number;
      capex: number;
      capex_spent: number;
      opex_mensual_total: number;
      opex_plazavea: number;
      opex_vivanda: number;
      opex_makro: number;
      total_available_percent?: number;
      available_percent?: number;
      alerts_90?: string[];
      budgets: {
        plazavea: number;
        vivanda: number;
        makro: number;
        capex: number;
        opex_anual: number;
      };
    };
    table_data: (DashboardRow & { expense_date?: string })[];
    team_expenses?: any[];
    total_budget?: string;
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

const cardStyle: CSSProperties = {
  background: '#ffffff',
  borderRadius: '14px',
  border: '1px solid #e2e8f0',
  padding: '1.4rem',
  boxShadow: '0 4px 10px rgba(15, 23, 42, 0.04)'
};

const formatMoney = (value: number) =>
  new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', minimumFractionDigits: 0 }).format(value);

const ContributorDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [savingRowId, setSavingRowId] = useState<number | null>(null);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());

  // CAPEX budget editing (Edwin only)
  const [isEditingCapexBudget, setIsEditingCapexBudget] = useState(false);
  const [capexEditMode, setCapexEditMode] = useState<'set' | 'add'>('add');
  const [capexBudgetValue, setCapexBudgetValue] = useState('');
  const [savingCapexBudget, setSavingCapexBudget] = useState(false);

  const dirtyRowsRef = useRef<Set<number>>(new Set());

  // Determine if this user is Edwin (capex-only)
  const isCapexOnly = sessionStorage.getItem('is_capex_only') === 'true';

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const token = sessionStorage.getItem('token');
      const response = await fetch('/api/dashboard', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.status === 401 || response.status === 403) {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('role');
        navigate('/login');
        return;
      }

      const result: DashboardResponse = await response.json();
      
      setDashboard(prevData => {
        if (!prevData) return result;
        
        const mergedTableData = result.table_data.map((serverRow) => {
          if (dirtyRowsRef.current.has(serverRow.id)) {
            const localRow = prevData.table_data.find(r => r.id === serverRow.id);
            return localRow ? { ...localRow } : serverRow;
          }
          return serverRow;
        });

        return {
          ...result,
          table_data: mergedTableData
        };
      });
    } catch (error) {
      console.error('Error loading collaborator dashboard', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const token = sessionStorage.getItem('token');
      const response = await fetch('/api/dashboard/history', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const result = await response.json();
        setHistory(result.history || []);
      }
    } catch (error) {
      console.error('Error loading history', error);
    }
  };

  useEffect(() => {
    fetchData();
    fetchHistory();

    const socket = io({ path: '/api/socket.io' });
    socket.on('dashboard_update', () => {
        fetchData(true);
        fetchHistory();
    });

    return () => {
        socket.disconnect();
    };
  }, []);

  // Initialize CAPEX budget value when data loads
  useEffect(() => {
    if (dashboard?.gauges?.budgets?.capex && !isEditingCapexBudget) {
      setCapexBudgetValue(dashboard.gauges.budgets.capex.toString());
    }
  }, [dashboard?.gauges?.budgets?.capex]);

  const handleInputChange = (id: number, field: string, value: string) => {
    dirtyRowsRef.current.add(id);
    if (!dashboard) return;
    setDashboard({
      ...dashboard,
      table_data: dashboard.table_data.map((row) =>
        row.id === id ? { ...row, [field]: value } : row
      )
    });
  };

  const handleSaveRow = async (row: DashboardRow) => {
    const ticket = String(row.ticket_value || '').trim();
    const ot = String(row.ot_value || '').trim();
    const monto = String(row.monto_value || '').trim();

    // Edwin (capex-only) doesn't need a ticket
    if (!isCapexOnly && (!ticket || ticket === '0')) {
      alert('Ingresa el ID de Ticket.');
      return;
    }
    if (!ot || ot === '0') {
      alert('Ingresa el Numero de OT.');
      return;
    }
    if (!monto || monto === '0') {
      alert('Ingresa un monto valido.');
      return;
    }

    // Enforce entity selection
    if (!row.entidad) {
      alert('Selecciona una entidad.');
      return;
    }

    // Edwin can only select CAPEX
    if (isCapexOnly && row.entidad !== 'CAPEX') {
      alert('Solo puedes registrar operaciones CAPEX.');
      return;
    }

    // Others cannot select CAPEX
    if (!isCapexOnly && row.entidad === 'CAPEX') {
      alert('No tienes permiso para registrar operaciones CAPEX.');
      return;
    }

    setSavingRowId(row.id);
    try {
      const token = sessionStorage.getItem('token');
      const response = await fetch('/api/dashboard/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          id: row.id,
          ticket_value: ticket,
          ot_value: ot,
          monto_value: monto,
          entidad: row.entidad,
          activos: row.activos,
          clear_after_save: false,
          expense_date: (row as any).expense_date || new Date().toISOString().split('T')[0]
        })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        alert(data.error || 'No se pudo guardar el registro.');
        return;
      }

      dirtyRowsRef.current.delete(row.id);
      await fetchData();
      await fetchHistory();
    } catch (error) {
      console.error('Error saving row', error);
      alert('Error de red al guardar.');
    } finally {
      setSavingRowId(null);
    }
  };

  // Edwin can update CAPEX budget
  const handleSaveCapexBudget = async () => {
    const numVal = Number(capexBudgetValue);
    if (!capexBudgetValue || isNaN(numVal) || numVal <= 0) {
      alert('Ingresa un valor mayor que cero.');
      return;
    }
    setSavingCapexBudget(true);
    try {
      const token = sessionStorage.getItem('token');
      const currentBudget = dashboard?.gauges?.budgets?.capex ?? 0;
      // 'add' mode: new total = current budget + amount; 'set' mode: new total = entered amount
      const newTotal = capexEditMode === 'add' ? currentBudget + numVal : numVal;
      const response = await fetch('/api/budget/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ capex_annual_budget: newTotal.toString() })
      });
      if (response.ok) {
        setIsEditingCapexBudget(false);
        setCapexBudgetValue('');
        await fetchData();
        await fetchHistory();
      } else {
        const err = await response.json().catch(() => ({}));
        alert(err.error || 'No se pudo actualizar el presupuesto CAPEX.');
      }
    } catch (e) {
      alert('Error de red.');
    } finally {
      setSavingCapexBudget(false);
    }
  };

  const handleDownloadExcel = () => {
    if (!dashboard || !dashboard.table_data) return;

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
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#000000"/>
  </Style>
  <Style ss:ID="s62">
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#1c4233" ss:Pattern="Solid"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Mi Registro">
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

    (dashboard.team_expenses || []).forEach((row: any) => {
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
 <Worksheet ss:Name="Mi Historial">
  <Table>
   <Column ss:Width="150"/>
   <Column ss:Width="110"/>
   <Column ss:Width="130"/>
   <Column ss:Width="380"/>
   <Row>
    <Cell ss:StyleID="s62"><Data ss:Type="String">Fecha</Data></Cell>
    <Cell ss:StyleID="s62"><Data ss:Type="String">Usuario</Data></Cell>
    <Cell ss:StyleID="s62"><Data ss:Type="String">Tipo</Data></Cell>
    <Cell ss:StyleID="s62"><Data ss:Type="String">Descripcion</Data></Cell>
   </Row>`;

    history.forEach((item) => {
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
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'Reporte_Mi_Actividad.xls');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('role');
    sessionStorage.removeItem('is_capex_only');
    sessionStorage.removeItem('username');
    navigate('/login');
  };

  if (loading) {
    return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: '#334155' }}>Cargando portal...</div>;
  }

  const currentRow = dashboard?.table_data?.[0];
  const gauges = dashboard?.gauges;
  const budgets = gauges?.budgets || { plazavea: 1, vivanda: 1, makro: 1, capex: 1, opex_anual: 1 };

  // OPEX Anual: remaining percentage (starts 100%, goes down)
  const opexAnualRemaining = gauges?.opex_anual ?? 0;
  const opexAnualPercent = gauges?.opex_anual_percent ?? 100;

  const opexPlazaVea = gauges?.opex_plazavea ?? 0;
  const opexVivanda = gauges?.opex_vivanda ?? 0;
  const opexMakro = gauges?.opex_makro ?? 0;
  const caRemaining = gauges?.capex ?? 0;

  const pvRemaining = budgets.plazavea - opexPlazaVea;
  const plazaveaPercent = Math.max(0, Math.min(100, (opexPlazaVea / budgets.plazavea) * 100));

  const viRemaining = budgets.vivanda - opexVivanda;
  const vivandaPercent = Math.max(0, Math.min(100, (opexVivanda / budgets.vivanda) * 100));

  const mkRemaining = budgets.makro - opexMakro;
  const makroPercent = Math.max(0, Math.min(100, (opexMakro / budgets.makro) * 100));

  const caSpent = budgets.capex - caRemaining;
  const capexPercent = Math.max(0, Math.min(100, (caSpent / budgets.capex) * 100));

  // Alerts (90%) — for Edwin only show CAPEX alerts (none currently, since CAPEX has no 90% entity check)
  // For regular contributors, show OPEX entity alerts
  const alerts90 = isCapexOnly
    ? [] // Edwin doesn't see OPEX entity alerts
    : (gauges?.alerts_90 || []).filter(a => !dismissedAlerts.has(a));

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', display: 'grid', gridTemplateColumns: '260px 1fr' }}>
      <aside style={{ background: '#f8fafc', borderRight: '1px solid #dbe3ec', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', fontWeight: 700, fontSize: '1.25rem', padding: '0.5rem 0.6rem' }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: isCapexOnly ? '#7c3aed' : '#14532d', color: '#fff', display: 'grid', placeItems: 'center' }}>
            <ClipboardList size={18} />
          </div>
          {isCapexOnly ? 'Portal CAPEX' : 'Portal de Colaborador'}
        </div>

        {isCapexOnly && (
          <div style={{ background: '#ede9fe', border: '1px solid #c4b5fd', borderRadius: 10, padding: '0.75rem', fontSize: '0.82rem', color: '#5b21b6', fontWeight: 600 }}>
            <DollarSign size={14} style={{ display: 'inline', marginRight: 4 }} />
            Eres responsable del módulo CAPEX
          </div>
        )}

        <button style={{ background: isCapexOnly ? '#7c3aed' : '#14532d', color: '#fff', border: 'none', borderRadius: 10, padding: '0.9rem 1rem', display: 'flex', alignItems: 'center', gap: '0.7rem', fontWeight: 700, cursor: 'pointer' }}>
          <LayoutDashboard size={18} /> Panel Principal
        </button>
        <button
          onClick={handleDownloadExcel}
          style={{ background: 'transparent', color: '#1e3a5f', border: 'none', borderRadius: 10, padding: '0.9rem 1rem', display: 'flex', alignItems: 'center', gap: '0.7rem', fontWeight: 600, cursor: 'pointer' }}
        >
          <FileText size={18} /> Reportes
        </button>

        <div style={{ marginTop: 'auto', borderTop: '1px solid #dbe3ec', paddingTop: '1rem' }}>
          <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, letterSpacing: '0.04em', marginBottom: '0.6rem', padding: '0 0.2rem' }}>
            CUENTA
          </div>
          <button
            onClick={handleLogout}
            style={{ width: '100%', background: '#ffffff', color: '#1e3a5f', border: '1px solid #dbe3ec', borderRadius: 10, padding: '0.8rem 1rem', display: 'flex', alignItems: 'center', gap: '0.6rem', fontWeight: 700, cursor: 'pointer' }}
          >
            <LogOut size={16} /> Cerrar sesión
          </button>
        </div>
      </aside>

      <main style={{ padding: '1rem 1.8rem 1.8rem', overflow: 'auto' }}>
        <header style={{ background: '#fff', borderRadius: 12, border: '1px solid #dbe3ec', padding: '0.8rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.8rem', color: '#0f172a' }}>Hola, {currentRow?.name || 'Colaborador'}</div>
            <div style={{ color: '#64748b', marginTop: 4, fontSize: '0.9rem' }}>
              {isCapexOnly
                ? 'Módulo CAPEX — Aquí puedes registrar y gestionar operaciones de capital.'
                : 'Portal de colaborador — Registra tus gastos OPEX correspondientes.'}
            </div>
          </div>
          {isCapexOnly && (
            <div style={{ background: '#7c3aed', color: 'white', borderRadius: 20, padding: '0.4rem 1rem', fontSize: '0.8rem', fontWeight: 700 }}>
              CAPEX ONLY
            </div>
          )}
        </header>

        {/* 90% ALERTS */}
        {alerts90.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
            {alerts90.map((entity) => (
              <div key={entity} style={{ background: '#fffbeb', border: '1px solid #f59e0b', borderRadius: 10, padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#92400e' }}>
                <AlertTriangle size={18} style={{ flexShrink: 0, color: '#d97706' }} />
                <span style={{ flex: 1, fontWeight: 600 }}>
                  ⚠️ <strong>Cuidado:</strong> se ha alcanzado el 90% de fondos de <strong>{entity}</strong>.
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

        {/* GAUGES */}
        <div style={{ display: 'grid', gridTemplateColumns: isCapexOnly ? '1fr 1fr' : 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '1rem' }}>
          {!isCapexOnly && (
            <>
              <Gauge
                title="OPEX ANUAL"
                value={formatMoney(opexAnualRemaining)}
                percentage={Math.max(0, Math.min(100, 100 - opexAnualPercent))}
                color="#1c4233"
                trendText={`Gasto: ${formatMoney(dashboard?.gauges?.opex_anual_spent ?? 0)}`}
                trendIsPositive={opexAnualPercent > 20}
              />
              <Gauge
                title="OPEX - PLAZA VEA"
                value={formatMoney(pvRemaining)}
                percentage={plazaveaPercent}
                color="#10b981"
                trendText={`Mensual: ${formatMoney(budgets.plazavea)}`}
                trendIsPositive={pvRemaining > 0}
              />
              <Gauge
                title="OPEX - VIVANDA"
                value={formatMoney(viRemaining)}
                percentage={vivandaPercent}
                color="#f59e0b"
                trendText={`Mensual: ${formatMoney(budgets.vivanda)}`}
                trendIsPositive={viRemaining > 0}
              />
              <Gauge
                title="OPEX - MAKRO"
                value={formatMoney(mkRemaining)}
                percentage={makroPercent}
                color="#ef4444"
                trendText={`Mensual: ${formatMoney(budgets.makro)}`}
                trendIsPositive={mkRemaining > 0}
              />
            </>
          )}

          {/* CAPEX gauge — always visible */}
          <Gauge
            title="CAPEX"
            value={formatMoney(caRemaining)}
            percentage={capexPercent}
            color="#8b5cf6"
            trendText={`Gasto: ${formatMoney(caSpent)}`}
            trendIsPositive={caRemaining > 0}
          />

          {isCapexOnly && (
            <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                ✎ Presupuesto CAPEX
              </div>
              {isEditingCapexBudget ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {/* Toggle: add vs set */}
                  <div style={{ display: 'flex', gap: '0.4rem', fontSize: '0.78rem', fontWeight: 700 }}>
                    <button
                      onClick={() => { setCapexEditMode('add'); setCapexBudgetValue(''); }}
                      style={{ flex: 1, padding: '5px', borderRadius: 6, border: `1px solid ${capexEditMode === 'add' ? '#7c3aed' : '#e2e8f0'}`, background: capexEditMode === 'add' ? '#ede9fe' : '#f8fafc', color: capexEditMode === 'add' ? '#7c3aed' : '#64748b', cursor: 'pointer' }}
                    >
                      + Añadir fondos
                    </button>
                    <button
                      onClick={() => { setCapexEditMode('set'); setCapexBudgetValue((dashboard?.gauges?.budgets?.capex ?? 0).toString()); }}
                      style={{ flex: 1, padding: '5px', borderRadius: 6, border: `1px solid ${capexEditMode === 'set' ? '#7c3aed' : '#e2e8f0'}`, background: capexEditMode === 'set' ? '#ede9fe' : '#f8fafc', color: capexEditMode === 'set' ? '#7c3aed' : '#64748b', cursor: 'pointer' }}
                    >
                      ↺ Reemplazar total
                    </button>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#7c3aed', background: '#f5f3ff', borderRadius: 6, padding: '4px 8px' }}>
                    {capexEditMode === 'add'
                      ? `Presupuesto actual: ${formatMoney(dashboard?.gauges?.budgets?.capex ?? 0)} — Ingresa cuánto deseas AÑADIR`
                      : `Ingresa el NUEVO presupuesto total (reemplazará el actual)`
                    }
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: '1.1rem', color: '#4c1d95' }}>S/.</span>
                    <input
                      type="number"
                      value={capexBudgetValue}
                      onChange={e => setCapexBudgetValue(e.target.value)}
                      placeholder={capexEditMode === 'add' ? 'Ej: 5000' : 'Ej: 30000'}
                      style={{ border: '1px solid #c4b5fd', borderRadius: 8, padding: '6px 10px', fontSize: '1rem', width: 120, outline: 'none' }}
                      autoFocus
                      min="0"
                    />
                    <button
                      onClick={handleSaveCapexBudget}
                      disabled={savingCapexBudget}
                      style={{ background: '#7c3aed', color: 'white', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.85rem', fontWeight: 600 }}
                    >
                      {savingCapexBudget ? '...' : <><Save size={14} /> Guardar</>}
                    </button>
                    <button
                      onClick={() => { setIsEditingCapexBudget(false); setCapexBudgetValue(''); }}
                      style={{ background: '#e2e8f0', color: '#475569', border: 'none', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#4c1d95' }}>{formatMoney(budgets.capex)}</div>
                  <button
                    onClick={() => { setIsEditingCapexBudget(true); setCapexEditMode('add'); setCapexBudgetValue(''); }}
                    style={{ background: '#ede9fe', color: '#7c3aed', border: '1px solid #c4b5fd', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <Edit2 size={12} /> Editar
                  </button>
                </div>
              )}
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.5rem' }}>
                Gastado: {formatMoney(caSpent)} • Restante: {formatMoney(caRemaining)}
              </div>
            </div>
          )}
        </div>

        <section style={{ display: 'flex', gap: '1.5rem', alignItems: 'stretch' }}>
          <div style={{ flex: 2.2, background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', boxShadow: '0 4px 10px rgba(15, 23, 42, 0.04)', padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                {isCapexOnly ? 'Registro de Operaciones CAPEX' : 'Registro de Gastos OPEX'}
              </h2>
              <span style={{ fontSize: '0.9rem', fontWeight: 700, background: isCapexOnly ? '#ede9fe' : '#f1f5f9', borderRadius: 999, padding: '0.35rem 0.8rem', color: isCapexOnly ? '#7c3aed' : '#334155' }}>
                {isCapexOnly ? 'CAPEX' : 'OPERACIONES'}
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: isCapexOnly ? 600 : 740 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ textAlign: 'left', padding: '0.8rem 0.5rem', color: '#94a3b8', fontWeight: 800, fontSize: '0.85rem' }}>FECHA</th>
                    <th style={{ textAlign: 'left', padding: '0.8rem 0.5rem', color: '#94a3b8', fontWeight: 800, fontSize: '0.85rem' }}>MIEMBRO</th>
                    {!isCapexOnly && (
                      <th style={{ textAlign: 'left', padding: '0.8rem 0.5rem', color: '#94a3b8', fontWeight: 800, fontSize: '0.85rem' }}>ID TICKET</th>
                    )}
                    <th style={{ textAlign: 'left', padding: '0.8rem 0.5rem', color: '#94a3b8', fontWeight: 800, fontSize: '0.85rem' }}>N° OT</th>
                    <th style={{ textAlign: 'left', padding: '0.8rem 0.5rem', color: '#94a3b8', fontWeight: 800, fontSize: '0.85rem' }}>ENTIDAD</th>
                    <th style={{ textAlign: 'left', padding: '0.8rem 0.5rem', color: '#94a3b8', fontWeight: 800, fontSize: '0.85rem' }}>ACTIVOS</th>
                    <th style={{ textAlign: 'left', padding: '0.8rem 0.5rem', color: '#94a3b8', fontWeight: 800, fontSize: '0.85rem' }}>MONTO (S/.)</th>
                    <th style={{ textAlign: 'center', padding: '0.8rem 0.5rem', color: '#94a3b8', fontWeight: 800, fontSize: '0.85rem' }}>ACCIÓN</th>
                  </tr>
                </thead>
                <tbody>
                  {(dashboard?.table_data || []).map((row) => (
                    <tr key={row.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '1rem 0.5rem' }}>
                        <input
                          type="date"
                          value={(row as any).expense_date || new Date().toISOString().split('T')[0]}
                          onChange={(e) => handleInputChange(row.id, 'expense_date', e.target.value)}
                          style={{ width: '100%', minWidth: '120px', border: '1px solid #d1d5db', background: '#f8fafc', borderRadius: 10, padding: '0.65rem 0.7rem', fontSize: '1rem' }}
                        />
                      </td>
                      <td style={{ padding: '1rem 0.5rem', fontWeight: 700, color: '#0f172a' }}>{row.name}</td>
                      {!isCapexOnly && (
                        <td style={{ padding: '1rem 0.5rem' }}>
                          <input
                            value={row.ticket_value || ''}
                            onChange={(e) => handleInputChange(row.id, 'ticket_value', e.target.value)}
                            placeholder="TK-..."
                            style={{ width: '100%', border: '1px solid #d1d5db', background: '#f8fafc', borderRadius: 10, padding: '0.65rem 0.7rem', fontSize: '1rem' }}
                          />
                        </td>
                      )}
                      <td style={{ padding: '1rem 0.5rem' }}>
                        <input
                          value={row.ot_value || ''}
                          onChange={(e) => handleInputChange(row.id, 'ot_value', e.target.value)}
                          placeholder="OT-..."
                          style={{ width: '100%', border: '1px solid #d1d5db', background: '#f8fafc', borderRadius: 10, padding: '0.65rem 0.7rem', fontSize: '1rem' }}
                        />
                      </td>
                      <td style={{ padding: '1rem 0.5rem' }}>
                        {isCapexOnly ? (
                          <div style={{ padding: '0.65rem 0.7rem', background: '#ede9fe', borderRadius: 10, fontWeight: 700, color: '#7c3aed', border: '1px solid #c4b5fd' }}>
                            CAPEX
                          </div>
                        ) : (
                          <select
                            value={row.entidad || ''}
                            onChange={(e) => handleInputChange(row.id, 'entidad', e.target.value)}
                            style={{ width: '100%', border: '1px solid #d1d5db', background: '#f8fafc', borderRadius: 10, padding: '0.65rem 0.7rem', fontSize: '1rem', outline: 'none' }}
                          >
                            <option value="">[Elegir...]</option>
                            <option value="Plaza Vea">Plaza Vea</option>
                            <option value="Vivanda">Vivanda</option>
                            <option value="Makro">Makro</option>
                          </select>
                        )}
                      </td>
                      <td style={{ padding: '1rem 0.5rem' }}>
                        <select
                          value={row.activos || ''}
                          onChange={(e) => handleInputChange(row.id, 'activos', e.target.value)}
                          style={{ width: '100%', minWidth: '150px', border: '1px solid #d1d5db', background: '#f8fafc', borderRadius: 10, padding: '0.65rem 0.7rem', fontSize: '1rem', outline: 'none' }}
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
                      <td style={{ padding: '1rem 0.5rem' }}>
                        <input
                          value={row.monto_value || ''}
                          onChange={(e) => handleInputChange(row.id, 'monto_value', e.target.value)}
                          placeholder="0.00"
                          style={{ width: '100%', border: '1px solid #d1d5db', background: '#f8fafc', borderRadius: 10, padding: '0.65rem 0.7rem', fontSize: '1rem' }}
                        />
                      </td>
                      <td style={{ padding: '1rem 0.5rem', textAlign: 'center' }}>
                        <button
                          onClick={() => {
                            // Auto-set entidad to CAPEX for Edwin
                            const rowToSave = isCapexOnly ? { ...row, entidad: 'CAPEX' } : row;
                            handleSaveRow(rowToSave);
                          }}
                          disabled={savingRowId === row.id}
                          style={{ background: isCapexOnly ? '#7c3aed' : '#14532d', color: '#fff', border: 'none', borderRadius: 10, width: 40, height: 40, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                          title="Guardar"
                        >
                          {savingRowId === row.id ? <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>...</span> : <Send size={16} />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ ...cardStyle, padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>Historial</h2>
                <span style={{ fontSize: '0.9rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>Ver Todo <ArrowRight size={14} /></span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '400px', overflowY: 'auto', paddingRight: '8px' }}>
                {history.length === 0 ? (
                  <div style={{ color: '#94a3b8', fontSize: '0.9rem', textAlign: 'center', padding: '1rem 0' }}>No hay acciones recientes.</div>
                ) : history.map((item) => {
                  let icon = <Activity size={16} />;
                  let bg = '#f1f5f9';
                  let color = '#64748b';

                  if (item.action_type === 'Edit Row') { icon = <Edit2 size={16} />; bg = '#eff6ff'; color = '#2563eb'; }
                  else if (item.action_type === 'Budget') { icon = <Building2 size={16} />; bg = '#dcfce7'; color = '#166534'; }
                  else if (item.action_type === 'Delete User') { icon = <Trash2 size={16} />; bg = '#fee2e2'; color = '#dc2626'; }
                  else if (item.action_type === 'Password') { icon = <Key size={16} />; bg = '#fef3c7'; color = '#b45309'; }
                  else if (item.action_type === 'Reset') { icon = <RefreshCcw size={16} />; bg = '#fee2e2'; color = '#b91c1c'; }
                  else if (item.action_type === 'Expense Added') { icon = <Send size={16} />; bg = isCapexOnly ? '#ede9fe' : '#dcfce7'; color = isCapexOnly ? '#7c3aed' : '#166534'; }

                  const dateObj = new Date(item.created_at);
                  const formattedDate = dateObj.toLocaleDateString('es-ES', { month: 'short', day: 'numeric', year: 'numeric' }) + ' · ' + dateObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

                  return (
                    <div key={item.id} style={{ border: '1px solid #f1f5f9', borderRadius: 12, padding: '0.85rem', display: 'flex', gap: '0.7rem', alignItems: 'center' }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: bg, color, display: 'grid', placeItems: 'center' }}>{icon}</div>
                      <div>
                        <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>{item.description}</div>
                        <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{formattedDate} · {item.username}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default ContributorDashboard;
