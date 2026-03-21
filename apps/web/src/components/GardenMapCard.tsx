interface PlantingItem {
  id: string;
  crop: string;
  variety: string | null;
  stage: string;
  health: string;
}

interface SpaceItem {
  id: string;
  name: string;
  type: string;
  width: number | null;
  length: number | null;
  unit: string | null;
  posX: number | null;
  posY: number | null;
  plantings: PlantingItem[];
}

interface GardenMapData {
  seasonName: string;
  seasonYear: number;
  hasPositions?: boolean;
  spaces: SpaceItem[];
  unassigned: PlantingItem[];
  spaceCount: number;
  plantingCount: number;
}

function healthIcon(health: string) {
  switch (health) {
    case "healthy":
      return { icon: "●", color: "text-emerald-400" };
    case "fair":
      return { icon: "◐", color: "text-yellow-400" };
    case "poor":
      return { icon: "○", color: "text-orange-400" };
    case "critical":
      return { icon: "✕", color: "text-red-400" };
    case "dead":
      return { icon: "✕", color: "text-gray-500" };
    default:
      return { icon: "●", color: "text-emerald-400" };
  }
}

function stageLabel(stage: string) {
  return stage.replace(/_/g, " ");
}

function spaceTypeIcon(type: string) {
  switch (type) {
    case "RaisedBed":
      return "🌱";
    case "Container":
      return "🪴";
    case "Tray":
      return "🫘";
    case "RowBed":
      return "🌾";
    case "Shelf":
      return "🪜";
    case "HardeningArea":
      return "🌤";
    default:
      return "📦";
  }
}

function SpaceCard({ space, style }: { space: SpaceItem; style?: React.CSSProperties }) {
  const dims = space.width && space.length
    ? `${space.width}×${space.length}${space.unit || "ft"}`
    : "";

  return (
    <div
      className="bg-white/[0.04] border border-white/[0.08] rounded-lg p-3 flex flex-col"
      style={style}
    >
      {/* Space header */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base">{spaceTypeIcon(space.type)}</span>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-emerald-100 truncate">
            {space.name}
          </div>
          <div className="text-[10px] text-emerald-300/40">
            {space.type}{dims ? ` ${dims}` : ""}
          </div>
        </div>
        <div className="text-[10px] text-emerald-300/30 shrink-0">
          {space.plantings.length} plant
          {space.plantings.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Plantings list */}
      {space.plantings.length === 0 ? (
        <div className="text-xs text-emerald-300/20 italic py-1">
          Empty
        </div>
      ) : (
        <div className="space-y-1 overflow-hidden flex-1">
          {space.plantings.map((p) => {
            const h = healthIcon(p.health);
            return (
              <div
                key={p.id}
                className="flex items-center gap-2 text-xs"
              >
                <span className={`${h.color} text-[10px]`}>
                  {h.icon}
                </span>
                <span className="text-emerald-200/80 flex-1 truncate">
                  {p.variety
                    ? `${p.crop} (${p.variety})`
                    : p.crop}
                </span>
                <span className="text-emerald-300/30 text-[10px]">
                  {stageLabel(p.stage)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SpatialLayout({ spaces }: { spaces: SpaceItem[] }) {
  const positioned = spaces.filter(
    (s) => s.posX != null && s.posY != null,
  );
  const unpositioned = spaces.filter(
    (s) => s.posX == null || s.posY == null,
  );

  if (positioned.length === 0) return null;

  // Compute bounding box
  const maxX = Math.max(
    ...positioned.map((s) => (s.posX ?? 0) + (s.width ?? 4)),
  );
  const maxY = Math.max(
    ...positioned.map((s) => (s.posY ?? 0) + (s.length ?? 4)),
  );

  // Scale to fit within container (max ~580px wide, reasonable height)
  const maxWidth = 580;
  const maxHeight = 500;
  const scale = Math.min(maxWidth / maxX, maxHeight / maxY, 64);
  const minCellSize = 100; // minimum space card size in px
  const effectiveScale = Math.max(scale, minCellSize / Math.min(...positioned.map(s => Math.min(s.width ?? 4, s.length ?? 4))));
  const finalScale = Math.min(effectiveScale, 64);

  const containerW = maxX * finalScale;
  const containerH = maxY * finalScale;

  return (
    <>
      <div
        className="relative mx-auto"
        style={{
          width: Math.min(containerW, maxWidth),
          height: containerH * (Math.min(containerW, maxWidth) / containerW),
        }}
      >
        {positioned.map((space) => {
          const w = space.width ?? 4;
          const h = space.length ?? 4;
          const ratio = Math.min(containerW, maxWidth) / containerW;
          return (
            <div
              key={space.id}
              className="absolute"
              style={{
                left: (space.posX ?? 0) * finalScale * ratio,
                top: (space.posY ?? 0) * finalScale * ratio,
                width: w * finalScale * ratio - 4,
                height: h * finalScale * ratio - 4,
              }}
            >
              <SpaceCard
                space={space}
                style={{ width: "100%", height: "100%", overflow: "hidden" }}
              />
            </div>
          );
        })}
      </div>
      {unpositioned.length > 0 && (
        <div className="mt-3 pt-3 border-t border-white/[0.06]">
          <div className="text-xs text-emerald-300/40 mb-2">Not positioned:</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {unpositioned.map((space) => (
              <SpaceCard key={space.id} space={space} />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export default function GardenMapCard({ data }: { data: GardenMapData }) {
  const { seasonName, seasonYear, spaces, unassigned, plantingCount, hasPositions } = data;

  return (
    <div className="bg-white/[0.05] border border-white/[0.1] rounded-xl p-4 my-2 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-emerald-100">
            {seasonName}{!seasonName.includes(String(seasonYear)) ? ` ${seasonYear}` : ""}
          </h3>
          <p className="text-xs text-emerald-300/50">
            {spaces.length} spaces &middot; {plantingCount} plantings
          </p>
        </div>
      </div>

      {/* Spaces — spatial or grid layout */}
      {hasPositions ? (
        <SpatialLayout spaces={spaces} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {spaces.map((space) => (
            <SpaceCard key={space.id} space={space} />
          ))}
        </div>
      )}

      {/* Unassigned */}
      {unassigned.length > 0 && (
        <div className="mt-3 pt-3 border-t border-white/[0.06]">
          <div className="text-xs text-amber-400/70 font-medium mb-1.5">
            Unassigned ({unassigned.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {unassigned.map((p) => (
              <span
                key={p.id}
                className="text-[10px] px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-300/70 rounded-full"
              >
                {p.variety ? `${p.crop} (${p.variety})` : p.crop}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
