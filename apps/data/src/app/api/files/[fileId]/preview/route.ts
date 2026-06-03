import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@mizan/database";
import { readFile } from "fs/promises";
import path from "path";
import xlsx from "xlsx";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { fileId } = await params;
  const file = await prisma.storedFile.findUnique({ where: { id: fileId } });
  if (!file) {
    return NextResponse.json({ error: "文件不存在" }, { status: 404 });
  }

  const fullPath = path.join(process.cwd(), "public", "uploads", file.storagePath);
  const ext = path.extname(file.originalName).toLowerCase();

  try {
    // Image files — return URL directly
    if (/\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(ext)) {
      return NextResponse.json({ type: "image", url: `/uploads/${file.storagePath}` });
    }

    // Excel files — parse and return sheets as tables
    if (/\.(xlsx|xls)$/i.test(ext)) {
      const wb = xlsx.readFile(fullPath, { type: "file" });
      const sheets = wb.SheetNames.map((name) => {
        const ws = wb.Sheets[name];
        const data = xlsx.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
        const headerRow = data.length > 0 ? Object.keys(data[0]) : [];
        return { name, headers: headerRow, rows: data.slice(0, 200) };
      });
      return NextResponse.json({ type: "excel", sheets, totalSheets: wb.SheetNames.length });
    }

    // CSV files — parse and return as table
    if (/\.csv$/i.test(ext)) {
      const content = await readFile(fullPath, "utf-8");
      const ws = xlsx.read(content, { type: "string" }).Sheets.Sheet1;
      if (ws) {
        const data = xlsx.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
        const headers = data.length > 0 ? Object.keys(data[0]) : [];
        return NextResponse.json({ type: "csv", headers, rows: data.slice(0, 200) });
      }
      const lines = content.split("\n").filter(Boolean);
      return NextResponse.json({ type: "text", content: lines.slice(0, 200).join("\n"), totalLines: lines.length });
    }

    // JSON files — parse and return as formatted data
    if (/\.json$/i.test(ext)) {
      const content = await readFile(fullPath, "utf-8");
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        const headers = parsed.length > 0 ? Object.keys(parsed[0]) : [];
        return NextResponse.json({ type: "json-table", headers, rows: parsed.slice(0, 200), totalRows: parsed.length });
      }
      return NextResponse.json({ type: "json", data: parsed });
    }

    // Text files — return raw content
    const content = await readFile(fullPath, "utf-8");
    return NextResponse.json({ type: "text", content: content.slice(0, 50000), totalChars: content.length });
  } catch (error) {
    return NextResponse.json({ type: "error", message: error instanceof Error ? error.message : "预览失败" });
  }
}
