import type { Filters } from "../types";

type Props = {
  filters: Filters;
  onChange: (next: Filters) => void;
};

export function FiltersBar({ filters, onChange }: Props) {
  return (
    <div className="card">
      <div className="title">Step 2. 키워드 검색 / 날짜 필터</div>

      <div className="grid">
        <label className="field">
          <div className="label">키워드</div>
          <input
            value={filters.keyword}
            placeholder="예: 여행, 일본, 번역 ... "
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
          <span>이미지 포함된 대화</span>
        </label>
      </div>
    </div>
  );
}
