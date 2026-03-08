import { useEffect, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, ArrowRight, Building2, ClipboardList, Edit2, FileText, Key, LayoutDashboard, LogOut, RefreshCcw, Send, Trash2 } from 'lucide-react';
import Gauge from '../components/Gauge';

interface DashboardRow {
  id: number;
  name: string;
  ticket_value: string;
  ot_value: string;
  monto_value: string;
}

interface DashboardResponse {
  gauges?: {
    opex_anual: number;
    capex: number;
    opex_mensual: number;
    utilization_percent?: number;
    available_percent?: number;
  };
  table_data: DashboardRow[];
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
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(value);

const ContributorDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [savingRowId, setSavingRowId] = useState<number | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/dashboard', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        navigate('/login');
        return;
      }

      const result: DashboardResponse = await response.json();
      setDashboard(result);
    } catch (error) {
      console.error('Error loading collaborator dashboard', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/dashboard/history', {
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
  }, []);

  const handleInputChange = (id: number, field: keyof DashboardRow, value: string) => {
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

    if (!ticket || ticket === '0') {
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

    setSavingRowId(row.id);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/dashboard/update', {
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
          clear_after_save: false
        })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        alert(data.error || 'No se pudo guardar el registro.');
        return;
      }

      await fetchData();
      await fetchHistory();
    } catch (error) {
      console.error('Error saving row', error);
      alert('Error de red al guardar.');
    } finally {
      setSavingRowId(null);
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
 <Worksheet ss:Name="Mi Registro">
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

    dashboard.table_data.forEach((row) => {
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
      const created = (item.created_at || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const user = (item.username || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const actionType = (item.action_type || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const description = (item.description || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

      xmlString += `
   <Row>
    <Cell><Data ss:Type="String">${created}</Data></Cell>
    <Cell><Data ss:Type="String">${user}</Data></Cell>
    <Cell><Data ss:Type="String">${actionType}</Data></Cell>
    <Cell><Data ss:Type="String">${description}</Data></Cell>
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
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    navigate('/login');
  };

  if (loading) {
    return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: '#334155' }}>Cargando portal...</div>;
  }

  const currentRow = dashboard?.table_data?.[0];
  const gauges = dashboard?.gauges;
  const utilizationPercent = Math.max(0, Math.min(100, gauges?.utilization_percent ?? 0));
  const availablePercent = Math.max(0, Math.min(100, gauges?.available_percent ?? 100 - utilizationPercent));
  const utilizationLabel = `${utilizationPercent.toFixed(1)}%`;

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', display: 'grid', gridTemplateColumns: '260px 1fr' }}>
      <aside style={{ background: '#f8fafc', borderRight: '1px solid #dbe3ec', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', fontWeight: 700, fontSize: '1.25rem', padding: '0.5rem 0.6rem' }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: '#14532d', color: '#fff', display: 'grid', placeItems: 'center' }}>
            <ClipboardList size={18} />
          </div>
          Portal de Colaborador
        </div>

        <button style={{ background: '#14532d', color: '#fff', border: 'none', borderRadius: 10, padding: '0.9rem 1rem', display: 'flex', alignItems: 'center', gap: '0.7rem', fontWeight: 700, cursor: 'pointer' }}>
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

      <main style={{ padding: '1rem 1.8rem 1.8rem' }}>
        <header style={{ background: '#fff', borderRadius: 12, border: '1px solid #dbe3ec', padding: '0.8rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.4rem' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.8rem', color: '#0f172a' }}>Hola, {currentRow?.name || 'Colaborador'}</div>
            <div style={{ color: '#64748b', marginTop: 4 }}>Página financiera compartida. Cualquier actualización de un administrador se refleja aquí.</div>
          </div>
        </header>

        <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem' }}>
          <Gauge
            title="OPEX ANUAL"
            value={formatMoney(gauges?.opex_anual ?? 0)}
            percentage={utilizationPercent}
            color="#1c4233"
            trendText={`${utilizationLabel} usado`}
            trendIsPositive={utilizationPercent <= 100}
          />
          <Gauge
            title="CAPEX"
            value={formatMoney(gauges?.capex ?? 0)}
            percentage={availablePercent}
            color="#8b5cf6"
            trendText={`${availablePercent.toFixed(1)}% disponible`}
            trendIsPositive={(gauges?.capex ?? 0) > 0}
          />
          <Gauge
            title="OPEX MENSUAL"
            value={formatMoney(gauges?.opex_mensual ?? 0)}
            percentage={utilizationPercent}
            color="#10b981"
            trendText={`${utilizationLabel} del presupuesto`}
            trendIsPositive={utilizationPercent <= 100}
          />
        </div>

        <section style={{ display: 'flex', gap: '1.5rem', alignItems: 'stretch' }}>
          <div style={{ flex: 2.2, background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', boxShadow: '0 4px 10px rgba(15, 23, 42, 0.04)', padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Registro de Gastos del Equipo</h2>
              <span style={{ fontSize: '0.9rem', fontWeight: 700, background: '#f1f5f9', borderRadius: 999, padding: '0.35rem 0.8rem', color: '#334155' }}>OPERACIONES</span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 740 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ textAlign: 'left', padding: '0.8rem 0.5rem', color: '#94a3b8', fontWeight: 800, fontSize: '0.85rem' }}>MIEMBRO DEL EQUIPO</th>
                    <th style={{ textAlign: 'left', padding: '0.8rem 0.5rem', color: '#94a3b8', fontWeight: 800, fontSize: '0.85rem' }}>ID DE TICKET</th>
                    <th style={{ textAlign: 'left', padding: '0.8rem 0.5rem', color: '#94a3b8', fontWeight: 800, fontSize: '0.85rem' }}>NUMERO DE OT</th>
                    <th style={{ textAlign: 'left', padding: '0.8rem 0.5rem', color: '#94a3b8', fontWeight: 800, fontSize: '0.85rem' }}>MONTO ($)</th>
                    <th style={{ textAlign: 'center', padding: '0.8rem 0.5rem', color: '#94a3b8', fontWeight: 800, fontSize: '0.85rem' }}>ACCION</th>
                  </tr>
                </thead>
                <tbody>
                  {(dashboard?.table_data || []).map((row) => (
                    <tr key={row.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '1rem 0.5rem', fontWeight: 700, color: '#0f172a' }}>{row.name}</td>
                      <td style={{ padding: '1rem 0.5rem' }}>
                        <input
                          value={row.ticket_value || '0'}
                          onChange={(e) => handleInputChange(row.id, 'ticket_value', e.target.value)}
                          style={{ width: '100%', border: '1px solid #d1d5db', background: '#f8fafc', borderRadius: 10, padding: '0.65rem 0.7rem', fontSize: '1rem' }}
                        />
                      </td>
                      <td style={{ padding: '1rem 0.5rem' }}>
                        <input
                          value={row.ot_value || '0'}
                          onChange={(e) => handleInputChange(row.id, 'ot_value', e.target.value)}
                          style={{ width: '100%', border: '1px solid #d1d5db', background: '#f8fafc', borderRadius: 10, padding: '0.65rem 0.7rem', fontSize: '1rem' }}
                        />
                      </td>
                      <td style={{ padding: '1rem 0.5rem' }}>
                        <input
                          value={row.monto_value || '0'}
                          onChange={(e) => handleInputChange(row.id, 'monto_value', e.target.value)}
                          style={{ width: '100%', border: '1px solid #d1d5db', background: '#f8fafc', borderRadius: 10, padding: '0.65rem 0.7rem', fontSize: '1rem' }}
                        />
                      </td>
                      <td style={{ padding: '1rem 0.5rem', textAlign: 'center' }}>
                        <button
                          onClick={() => handleSaveRow(row)}
                          disabled={savingRowId === row.id}
                          style={{ background: '#14532d', color: '#fff', border: 'none', borderRadius: 10, width: 40, height: 40, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
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
                <h2 style={{ fontSize: '2rem', fontWeight: 800, margin: 0 }}>Historial</h2>
                <span style={{ fontSize: '0.9rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>Ver Todo <ArrowRight size={14} /></span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {history.length === 0 ? (
                  <div style={{ color: '#94a3b8', fontSize: '0.9rem', textAlign: 'center', padding: '1rem 0' }}>No hay acciones recientes.</div>
                ) : history.slice(0, 5).map((item) => {
                  let icon = <Activity size={16} />;
                  let bg = '#f1f5f9';
                  let color = '#64748b';

                  if (item.action_type === 'Edit Row') {
                    icon = <Edit2 size={16} />;
                    bg = '#eff6ff';
                    color = '#2563eb';
                  } else if (item.action_type === 'Budget') {
                    icon = <Building2 size={16} />;
                    bg = '#dcfce7';
                    color = '#166534';
                  } else if (item.action_type === 'Delete User') {
                    icon = <Trash2 size={16} />;
                    bg = '#fee2e2';
                    color = '#dc2626';
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
