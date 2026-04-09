# Sistema de Control de Presupuesto OPEX/CAPEX - Analista

Este documento describe la arquitectura y las funcionalidades actualizadas del sistema de control presupuestario, enfocado en la trazabilidad histórica y el manejo de periodos fiscales rodantes.

## 🚀 Cambios Principales

El sistema ha evolucionado de un modelo de actualización simple a un sistema de gestión de activos y gastos con historial completo.

### 1. Lógica de Mes Rodante (Periodo Fiscal)

Anteriormente, los gastos se calculaban por meses calendario. Ahora, el sistema utiliza un **periodo fiscal del 22 al 21**:

- **Definición:** Todo gasto realizado entre el 22 de un mes y el 21 del mes siguiente pertenece al presupuesto del mes siguiente.
- **Ejemplo:** Un gasto del 22 de Marzo al 21 de Abril se contabiliza como gasto de **Abril**.
- **Cierre Automático:** El sistema detecta la fecha del gasto y lo asigna automáticamente al periodo correspondiente en los reportes y indicadores z(Gauges).

### 2. Trazabilidad Histórica de Gastos

Se ha implementado una base de datos histórica (`expenses`) que permite:

- **No sobrescribir datos:** Las filas de los usuarios en el dashboard ya no son el único registro. Cada vez que se "Guarda" una fila, se crea un nuevo registro histórico.
- **Auditoría:** Se mantiene un registro exacto de quién, cuándo, por qué monto y en qué entidad se realizó cada gasto.
- **Reportes Precisos:** Los indicadores de "Gasto Mensual" ahora suman todos los registros históricos del periodo actual.

### 3. Independencia de OPEX y CAPEX

El sistema ahora separa completamente ambos rubros:

- **OPEX:** Dividido por formatos (Plaza Vea, Vivanda, Makro) con presupuestos mensuales independientes.
- **CAPEX:** Tiene su propio presupuesto **Anual** y un indicador de avance independiente.
- **Lógica Condicional:** Al seleccionar "CAPEX" o si el usuario es "Edwin", el campo **ID de Ticket** es opcional o se oculta, ya que el CAPEX se maneja principalmente por Número de OT.

### 4. Interfaz de Usuario Premium (UI)

Se han rediseñado los componentes visuales para mayor claridad:

- **Gauges Informativos:** Los indicadores muestran el monto **Restante** como valor principal y el **Presupuesto Asignado** como referencia.
- **Alertas Visuales:** Cambian de color y texto según si se está dentro o fuera del presupuesto.
- **Campo de Fecha:** Se añadió una columna de fecha en la tabla de registros para permitir ingresar gastos con fechas específicas (retroactivas o actuales).

### 5. Exportación a Excel Mejorada

Los reportes descargables ahora incluyen:

- **Columna de Fecha:** Fundamental para la conciliación contable.
- **Desglose por Miembro:** Mantiene el detalle de quién generó cada gasto.

---

## 🛠️ Cómo funciona ahora el programa

### Para el Administrador:

1. **Configuración de Presupuestos:** El administrador establece los montos mensuales para OPEX y anuales para CAPEX (vía base de datos/ajustes).
2. **Monitoreo Real:** Los gráficos se actualizan en tiempo real sumando todos los tickets ingresados por el equipo en el periodo vigente (22 al 21).
3. **Control de Usuarios:** Puede ver el historial detallado de acciones y eliminar registros si es necesario.

### Para el Colaborador:

1. **Ingreso de Gastos:**
   - Selecciona la **Fecha** del ticket/gasto.
   - Ingresa el **ID de Ticket** (si es OPEX).
   - Ingresa el **Número de OT**.
   - Selecciona la **Entidad** (Plaza Vea, Vivanda, Makro o CAPEX).
   - Ingresa el **Monto**.
2. **Visualización de Avance:** Puede ver cuánto presupuesto queda disponible en su formato antes de subir el gasto.
3. **Descarga de Actividad:** Puede exportar su propio historial con fechas precisas para rendición de cuentas.

---

## 💻 Detalles Técnicos

- **Base de Datos:** Nueva tabla `expenses` con relación a `users`.
- **Backend (Node.js):** Función `getFiscalPeriod()` para determinar el rango de fechas (22 al 21).
- **Frontend (React):** Componentes de Gauge optimizados con `CSS transitions` y lógica de porcentajes dinámica.
