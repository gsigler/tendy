interface GridCell {
  row: number;
  col: number;
  crop: string | null;
  variety: string | null;
  stage: string | null;
  health: string | null;
  abbrev: string | null;
}

interface SpaceGridData {
  spaceName: string;
  spaceType: string;
  width: number;
  length: number;
  unit: string;
  plantingCount: number;
  grid: GridCell[];
}

const CROP_COLORS: Record<string, string> = {
  tomato: "bg-red-500/40 border-red-400/50",
  pepper: "bg-orange-500/40 border-orange-400/50",
  basil: "bg-green-400/40 border-green-300/50",
  lettuce: "bg-lime-400/40 border-lime-300/50",
  cucumber: "bg-emerald-500/40 border-emerald-400/50",
  squash: "bg-yellow-500/40 border-yellow-400/50",
  bean: "bg-amber-600/40 border-amber-500/50",
  pea: "bg-teal-400/40 border-teal-300/50",
  carrot: "bg-orange-400/40 border-orange-300/50",
  onion: "bg-purple-400/40 border-purple-300/50",
  garlic: "bg-purple-300/40 border-purple-200/50",
  herb: "bg-green-300/40 border-green-200/50",
  flower: "bg-pink-400/40 border-pink-300/50",
  corn: "bg-yellow-400/40 border-yellow-300/50",
};

function getCropColor(crop: string | null): string {
  if (!crop) return "bg-white/[0.03] border-white/[0.06]";
  const key = crop.toLowerCase();
  for (const [name, color] of Object.entries(CROP_COLORS)) {
    if (key.includes(name)) return color;
  }
  // Generate consistent color from crop name
  const hash = key.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const hues = [
    "bg-cyan-400/40 border-cyan-300/50",
    "bg-rose-400/40 border-rose-300/50",
    "bg-violet-400/40 border-violet-300/50",
    "bg-sky-400/40 border-sky-300/50",
    "bg-fuchsia-400/40 border-fuchsia-300/50",
  ];
  return hues[hash % hues.length];
}

function getHealthBorder(health: string | null): string {
  switch (health) {
    case "fair":
      return "ring-1 ring-yellow-400/60";
    case "poor":
      return "ring-2 ring-orange-400/60";
    case "critical":
      return "ring-2 ring-red-500/80";
    case "dead":
      return "ring-2 ring-gray-500/80 opacity-50";
    default:
      return "";
  }
}

export default function SpaceGridCard({ data }: { data: SpaceGridData }) {
  const { spaceName, spaceType, width, length, unit, grid } = data;

  // Build legend
  const legendItems = new Map<
    string,
    { crop: string; variety: string | null; health: string | null; abbrev: string }
  >();
  for (const cell of grid) {
    if (cell.crop && cell.abbrev && !legendItems.has(cell.abbrev)) {
      legendItems.set(cell.abbrev, {
        crop: cell.crop,
        variety: cell.variety,
        health: cell.health,
        abbrev: cell.abbrev,
      });
    }
  }

  const totalCells = width * length;
  const usedCells = grid.filter((c) => c.crop).length;

  return (
    <div className="bg-white/[0.05] border border-white/[0.1] rounded-xl p-4 my-2 max-w-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-emerald-100">
            {spaceName}
          </h3>
          <p className="text-xs text-emerald-300/50">
            {spaceType} &middot; {width}&times;{length} {unit}
          </p>
        </div>
        <div className="text-xs text-emerald-300/40">
          {usedCells}/{totalCells} cells
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        {/* Column headers */}
        <div className="flex ml-6 mb-0.5">
          {Array.from({ length: width }, (_, c) => (
            <div
              key={c}
              className="flex-shrink-0 w-12 text-center text-[10px] text-emerald-400/40 font-mono"
            >
              {c}
            </div>
          ))}
        </div>

        {/* Rows */}
        {Array.from({ length }, (_, r) => (
          <div key={r} className="flex items-center gap-0.5 mb-0.5">
            <div className="w-5 text-right text-[10px] text-emerald-400/40 font-mono mr-0.5">
              {r}
            </div>
            {Array.from({ length: width }, (_, c) => {
              const cell = grid.find((g) => g.row === r && g.col === c);
              const color = getCropColor(cell?.crop ?? null);
              const healthRing = getHealthBorder(cell?.health ?? null);

              return (
                <div
                  key={c}
                  className={`flex-shrink-0 w-12 h-10 rounded-md border flex items-center justify-center transition-all hover:scale-105 cursor-default ${color} ${healthRing}`}
                  title={
                    cell?.crop
                      ? `${cell.crop}${cell.variety ? ` (${cell.variety})` : ""}\nStage: ${cell.stage}\nHealth: ${cell.health}\nPosition: row ${r}, col ${c}`
                      : `Empty (row ${r}, col ${c})`
                  }
                >
                  <span className="text-[10px] font-bold text-white/80 font-mono">
                    {cell?.abbrev ?? ""}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      {legendItems.size > 0 && (
        <div className="mt-3 pt-3 border-t border-white/[0.06]">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {Array.from(legendItems.values()).map((item) => (
              <div
                key={item.abbrev}
                className="flex items-center gap-1.5 text-xs"
              >
                <div
                  className={`w-3 h-3 rounded-sm ${getCropColor(item.crop)}`}
                />
                <span className="font-mono text-emerald-300/60 text-[10px]">
                  {item.abbrev}
                </span>
                <span className="text-emerald-200/70">
                  {item.variety
                    ? `${item.crop} (${item.variety})`
                    : item.crop}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
