import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { FilterGroup } from "@/lib/query/dynamic-query-builder";

export function useTableData(tableId: string | undefined) {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [sort, setSort] = useState<string | undefined>();
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<FilterGroup | undefined>();

  const query = useQuery({
    queryKey: ["table-data", tableId, page, pageSize, sort, order, search, filters],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (sort) params.set("sort", sort);
      if (order) params.set("order", order);
      if (search) params.set("search", search);
      if (filters && filters.conditions.length > 0) {
        params.set("filters", JSON.stringify(filters));
      }

      const res = await fetch(`/api/tables/${tableId}/data?${params}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "查询失败");
      }
      return res.json();
    },
    enabled: !!tableId,
  });

  return {
    ...query,
    page,
    setPage,
    sort,
    setSort: (col: string) => {
      if (sort === col) {
        setOrder(order === "asc" ? "desc" : "asc");
      } else {
        setSort(col);
        setOrder("asc");
      }
    },
    order,
    search,
    setSearch: (v: string) => {
      setSearch(v);
      setPage(1);
    },
    filters,
    setFilters: (f: FilterGroup | undefined) => {
      setFilters(f);
      setPage(1);
    },
  };
}
