import type { Filters } from "../types";

type Props = {
  filters: Filters;
  onChange: (next: Filters) => void;
};

export function FiltersBar({ filters, onChange }: Props) {
  return (
    <div className="card">
      <div className="title">2) Search / Filter</div>

      <div className="grid">
        <label className="field">
          <div className="label">Keyword</div>
          <input
            value={filters.keyword}
            placeholder="예: image, Unity, EmoShortcuts..."
            onChange={(e) => onChange({ ...filters, keyword: e.target.value })}
          />
        </label>

        <label className="field">
          <div className="label">From</div>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => onChange({ ...filters, dateFrom: e.target.value })}
          />
        </label>

        <label className="field">
          <div className="label">To</div>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => onChange({ ...filters, dateTo: e.target.value })}
          />
        </label>

        <label className="field checkbox">
          <input
            type="checkbox"
            checked={filters.imagesOnly}
            onChange={(e) =>
              onChange({ ...filters, imagesOnly: e.target.checked })
            }
          />
          <span>Images only</span>
        </label>
      </div>
    </div>
  );
}
