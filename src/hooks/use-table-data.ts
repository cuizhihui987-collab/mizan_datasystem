import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useTableData(tableId: string | undefined) {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [sort, setSort] = useState<string | undefined>();
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [search, setSearch] = useState("");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filters: Record<string, any> = {};
  if (search) filters._search = search;

  const query = useQuery({
    queryKey: ["table-data", tableId, page, pageSize, sort, order, search],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (sort) params.set("sort", sort);
      if (order) params.set("order", order);
      if (search) params.set("filters", JSON.stringify({ _global: search }));

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
  };
}
