import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";
import { SpreadsheetParser } from "@/lib/import/spreadsheet-parser";
import path from "path";
import { z } from "zod";

const parseSchema = z.object({
  headerRow: z.number().int().min(1).default(1),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ importId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { importId } = await params;

  const importJob = await prisma.importJob.findFirst({
    where: { id: importId, schema: { userId: session.user.id } },
  });

  if (!importJob) {
    return NextResponse.json({ error: "导入记录不存在" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const parsed = parseSchema.safeParse(body);

    const headerRow = parsed.success ? parsed.data.headerRow : 1;

    const fullPath = path.join(process.cwd(), "public", importJob.filePath);
    const parser = new SpreadsheetParser(fullPath);
    const result = await parser.parse(headerRow);

    // Update the import job with header row info
    await prisma.importJob.update({
      where: { id: importId },
      data: {
        headerRow,
        totalRows: result.totalRows,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Parse error:", error);
    return NextResponse.json(
      { error: "文件解析失败，请确认文件格式正确" },
      { status: 500 }
    );
  }
}
