import React, { useMemo, useState } from 'react'

const columns = 18
const tileSize = 26
const tileGap = 6

function tileColor(status) {
  if (status === 'BNP') return '#2f6b3d'
  if (status === 'JP') return '#1f4a7c'
  if (status === '11PA') return '#c07a4b'
  if (status === 'TIED') return '#b69b7b'
  if (status === 'NO_VOTES') return '#e2d6c2'
  return '#f3d8a1'
}

export default function Map({ constituencies, selected, onSelect, leaders }) {
  const [hovered, setHovered] = useState(null)

  const tiles = useMemo(() => {
    return [...constituencies].sort((a, b) => a.constituency_no - b.constituency_no)
  }, [constituencies])

  const rows = Math.ceil(tiles.length / columns)
  const width = columns * (tileSize + tileGap) + tileGap
  const height = rows * (tileSize + tileGap) + tileGap

  return (
    <svg
      className="tile-map"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Constituency tile map"
    >
      {tiles.map((c, index) => {
        const col = index % columns
        const row = Math.floor(index / columns)
        const x = tileGap + col * (tileSize + tileGap)
        const y = tileGap + row * (tileSize + tileGap)
        const isSelected = selected && selected.constituency_no === c.constituency_no
        const leader = leaders?.[c.constituency_no]
        const status = leader?.is_tied
          ? 'TIED'
          : leader?.leader?.alliance_key || (c.is_disabled ? 'DISABLED' : 'NO_VOTES')

        return (
          <g key={c.constituency_no}>
            <rect
              x={x}
              y={y}
              width={tileSize}
              height={tileSize}
              rx={6}
              ry={6}
              className="tile"
              fill={c.is_disabled ? '#c9c2b8' : tileColor(status)}
              stroke={isSelected ? '#1f1b16' : '#bfae94'}
              strokeWidth={isSelected ? 2.5 : 1}
              onMouseEnter={() => setHovered(c)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onSelect(c)}
            />
          </g>
        )
      })}
      {hovered ? (
        <g>
          <rect x="10" y={height - 36} width="220" height="26" rx="8" fill="#ffffff" stroke="#d9cbb1" />
          <text x="20" y={height - 18} fontSize="12" fill="#1f1b16">
            {hovered.seat} · #{hovered.constituency_no}
          </text>
        </g>
      ) : null}
    </svg>
  )
}
