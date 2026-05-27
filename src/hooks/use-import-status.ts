import { useQuery } from "@tanstack/react-query";

export function useImportStatus(importId: string | null) {
  return useQuery({
    queryKey: ["import-status", importId],
    queryFn: async () => {
      const res = await fetch(`/api/imports/${importId}`);
      if (!res.ok) throw new Error("获取导入状态失败");
      return res.json();
    },
    enabled: !!importId,
    refetchInterval: (query) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = query.state.data as any;
      if (!data) return 2000;
      return data.status === "PROCESSING" ? 2000 : false;
    },
  });
}
