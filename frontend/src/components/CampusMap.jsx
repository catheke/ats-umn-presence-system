/**
 * Mapa Visual do Campus IPH — ATS-UMN Presence System
 * Representação SVG simplificada do campus do Instituto Politécnico da Huíla
 * Lubango, Província da Huíla, Angola
 */

const STATUS_FILL = {
  low:    { fill: '#dcfce7', stroke: '#22c55e', dot: '#16a34a' },
  medium: { fill: '#fef3c7', stroke: '#f59e0b', dot: '#d97706' },
  high:   { fill: '#fee2e2', stroke: '#ef4444', dot: '#dc2626' },
  full:   { fill: '#fecaca', stroke: '#991b1b', dot: '#7f1d1d' },
  idle:   { fill: '#f1f5f9', stroke: '#cbd5e1', dot: '#94a3b8' },
}

function getStyle(zones, id) {
  const z = zones[id]
  return STATUS_FILL[z?.status ?? 'idle']
}

function ZoneRect({ x, y, w, h, label, sublabel, zone, rx = 8 }) {
  const st = zone ? STATUS_FILL[zone.status] : STATUS_FILL.idle
  const pct = zone ? Math.round(zone.occupancy_percent) : 0
  const count = zone?.current_count ?? 0

  return (
    <g>
      <rect
        x={x} y={y} width={w} height={h} rx={rx}
        fill={st.fill} stroke={st.stroke} strokeWidth="1.5"
        style={{ transition: 'fill 0.5s ease, stroke 0.5s ease' }}
      />
      {/* Barra de ocupação no fundo */}
      <rect
        x={x + 2} y={y + h - 5} width={Math.max(0, (w - 4) * pct / 100)} height={3} rx={1.5}
        fill={st.dot} opacity={0.7}
        style={{ transition: 'width 0.6s ease, fill 0.5s ease' }}
      />
      {/* Indicador pontinho */}
      <circle cx={x + w - 10} cy={y + 10} r={4} fill={st.dot} className={zone?.status === 'full' ? 'pulse-dot' : ''} style={{ transition: 'fill 0.5s ease' }} />
      {/* Texto */}
      <text x={x + 8} y={y + 18} fontSize="8" fontWeight="700" fill="#1e3a8a" fontFamily="Inter, sans-serif">{label}</text>
      {sublabel && <text x={x + 8} y={y + 28} fontSize="7" fill="#64748b" fontFamily="Inter, sans-serif">{sublabel}</text>}
      {zone && (
        <text x={x + 8} y={y + h - 10} fontSize="7.5" fontWeight="600" fill={st.dot} fontFamily="Inter, sans-serif">
          {count} / {zone.capacity}
        </text>
      )}
    </g>
  )
}

export default function CampusMap({ zones }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-navy-800 uppercase tracking-wider">Mapa do Campus IPH</h2>
        <div className="flex items-center gap-3 text-[10px]">
          {[
            { label: 'Baixa', fill: '#dcfce7', stroke: '#22c55e' },
            { label: 'Média', fill: '#fef3c7', stroke: '#f59e0b' },
            { label: 'Alta',  fill: '#fee2e2', stroke: '#ef4444' },
            { label: 'Lotado',fill: '#fecaca', stroke: '#991b1b' },
          ].map(({ label, fill, stroke }) => (
            <span key={label} className="flex items-center gap-1 text-slate-500">
              <span style={{ background: fill, border: `1.5px solid ${stroke}`, borderRadius: 3, display: 'inline-block', width: 14, height: 10 }} />
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox="0 0 620 380"
          className="w-full max-w-full"
          style={{ minWidth: 360, fontFamily: 'Inter, sans-serif' }}
        >
          {/* Fundo do campus */}
          <rect x="0" y="0" width="620" height="380" rx="12" fill="#f8fafc" />

          {/* Ruas internas */}
          <rect x="190" y="0" width="20" height="380" fill="#e2e8f0" opacity={0.6} />
          <rect x="0" y="175" width="620" height="16" fill="#e2e8f0" opacity={0.6} />
          <rect x="410" y="0" width="20" height="380" fill="#e2e8f0" opacity={0.6} />

          {/* Portão Principal */}
          <rect x="265" y="5" width="90" height="22" rx="4" fill="#1e3a8a" opacity={0.12} stroke="#1e3a8a" strokeWidth="1" strokeDasharray="3,2" />
          <text x="310" y="20" textAnchor="middle" fontSize="8" fill="#1e3a8a" fontWeight="600">🚪 Portão Principal</text>

          {/* ---- BLOCO A — Salas de Aula ---- */}
          <text x="15" y="50" fontSize="9" fontWeight="700" fill="#475569" letterSpacing="1">BLOCO A</text>
          <ZoneRect x={15} y={55} w={160} h={52} label="Sala 1.4" sublabel="Eng. Informática" zone={zones['sala_14']} />
          <ZoneRect x={15} y={115} w={160} h={52} label="Sala 1.5" sublabel="Computação" zone={zones['sala_15']} />

          {/* ---- BLOCO B — Salas ---- */}
          <text x="215" y="50" fontSize="9" fontWeight="700" fill="#475569" letterSpacing="1">BLOCO B</text>
          <ZoneRect x={215} y={55} w={180} h={52} label="Sala 2.1" sublabel="Eng. Civil" zone={zones['sala_21']} />
          <ZoneRect x={215} y={115} w={180} h={52} label="Sala 2.3" sublabel="Eng. Mecânica" zone={zones['sala_23']} />

          {/* ---- BLOCO C — Laboratórios ---- */}
          <text x="435" y="50" fontSize="9" fontWeight="700" fill="#475569" letterSpacing="1">BLOCO C — LABS</text>
          <ZoneRect x={435} y={55} w={170} h={52} label="Lab. Informática I" sublabel="30 postos" zone={zones['lab_info_1']} />
          <ZoneRect x={435} y={115} w={170} h={52} label="Lab. Informática II" sublabel="30 postos" zone={zones['lab_info_2']} />

          {/* Divisória central  */}
          <text x="310" y="168" textAnchor="middle" fontSize="7.5" fill="#94a3b8">───── via central ─────</text>

          {/* ---- EDIFÍCIO CENTRAL — Auditório ---- */}
          <text x="215" y="210" fontSize="9" fontWeight="700" fill="#475569" letterSpacing="1">EDIFÍCIO CENTRAL</text>
          <ZoneRect x={215} y={215} w={180} h={70} label="Auditório Principal" sublabel="300 lugares" zone={zones['auditorio']} rx={10} />

          {/* ---- BIBLIOTECA ---- */}
          <text x="15" y="210" fontSize="9" fontWeight="700" fill="#475569" letterSpacing="1">BIBLIOTECA</text>
          <ZoneRect x={15} y={215} w={160} h={70} label="Biblioteca Central" sublabel="100 lugares" zone={zones['biblioteca']} rx={10} />

          {/* ---- REFEITÓRIO ---- */}
          <text x="435" y="210" fontSize="9" fontWeight="700" fill="#475569" letterSpacing="1">APOIO</text>
          <ZoneRect x={435} y={215} w={170} h={70} label="Refeitório Central" sublabel="180 lugares" zone={zones['cafeteria']} rx={10} />

          {/* ---- SECRETARIA + ADMIN ---- */}
          <text x="15" y="305" fontSize="9" fontWeight="700" fill="#475569" letterSpacing="1">ADMINISTRAÇÃO</text>
          <ZoneRect x={15} y={310} w={160} h={58} label="Secretaria Académica" sublabel="Edifício Administrativo" zone={zones['secretaria']} />

          {/* Área verde (jardim) */}
          <ellipse cx={360} cy={345} rx={65} ry={25} fill="#dcfce7" stroke="#86efac" strokeWidth="1" opacity={0.7} />
          <text x="360" y="349" textAnchor="middle" fontSize="8" fill="#16a34a">🌿 Jardim Central</text>

          {/* Logótipo IPH no canto */}
          <rect x="510" y="310" width="95" height="55" rx="6" fill="white" stroke="#e2e8f0" strokeWidth="1" />
          <text x="557" y="330" textAnchor="middle" fontSize="8" fontWeight="700" fill="#0f2d5c">IPH · UMN</text>
          <text x="557" y="342" textAnchor="middle" fontSize="6.5" fill="#64748b">Lubango · Angola</text>
          <text x="557" y="354" textAnchor="middle" fontSize="6" fill="#94a3b8">Monitorização em</text>
          <text x="557" y="363" textAnchor="middle" fontSize="6" fill="#94a3b8">Tempo Real</text>
        </svg>
      </div>
    </div>
  )
}
