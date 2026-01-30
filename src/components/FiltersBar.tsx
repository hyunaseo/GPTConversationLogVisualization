import * as React from "react";
import type { Filters } from "../types";

type Props = {
  filters: Filters;
  onFiltersChange: (f: Filters) => void;
};

export function FiltersBar({ filters, onFiltersChange }: Props) {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    onFiltersChange({
      ...filters,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  return (
    <div className="card">
      <div className="row" style={{ alignItems: "center" }}>
        <div style={{ flex: 1 }}>
          <input
            type="text"
            name="keyword"
            placeholder="Search by keyword..."
            value={filters.keyword}
            onChange={handleInputChange}
            style={{ width: "100%" }}
          />
        </div>
        <div style={{ flex: 1, marginLeft: 10 }}>
          <label>
            From:{" "}
            <input
              type="date"
              name="dateFrom"
              value={filters.dateFrom}
              onChange={handleInputChange}
            />
          </label>
        </div>
        <div style={{ flex: 1, marginLeft: 10 }}>
          <label>
            To:{" "}
            <input
              type="date"
              name="dateTo"
              value={filters.dateTo}
              onChange={handleInputChange}
            />
          </label>
        </div>

      </div>
    </div>
  );
}